import { Injectable, Logger } from '@nestjs/common';
import * as dns from 'node:dns/promises';
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as path from 'node:path';

export interface AuditTarget {
  url?: string;
  folder?: string;
}

export interface LoadedPage {
  url: string;
  file?: string;
  html: string;
}

const MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 10_000;

@Injectable()
export class FetcherService {
  private readonly logger = new Logger(FetcherService.name);

  async loadPages(target: AuditTarget): Promise<{ pages: LoadedPage[]; siteRoot?: URL }> {
    if (target.folder) return this.loadFolder(target.folder);
    if (target.url) return this.loadUrl(target.url);
    throw new Error('Provide a url or a folder to audit (e.g. --url https://... or --folder ./site).');
  }

  /** Load a site-level file (robots.txt, sitemap.xml) when auditing a URL. */
  async fetchSiteFile(siteRoot: URL, pathname: string): Promise<string | null> {
    try {
      const res = await this.guardedFetch(new URL(pathname, siteRoot).toString());
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  async contentLength(url: string): Promise<number | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timer);
      const len = res.headers.get('content-length');
      return len ? Number(len) : null;
    } catch {
      return null;
    }
  }

  private async loadUrl(rawUrl: string): Promise<{ pages: LoadedPage[]; siteRoot: URL }> {
    const siteRoot = new URL(rawUrl);
    const res = await this.guardedFetch(siteRoot.toString());
    const html = await res.text();
    return { pages: [{ url: siteRoot.toString(), html }], siteRoot };
  }

  private async loadFolder(folder: string): Promise<{ pages: LoadedPage[] }> {
    const root = path.resolve(folder);
    const files = await this.findHtmlFiles(root);
    const pages = await Promise.all(
      files.slice(0, MAX_PAGES).map(async (file) => {
        const html = await fs.readFile(file, 'utf8');
        const rel = path.relative(root, file).split(path.sep).join('/');
        return { url: `/${rel}`, file, html } satisfies LoadedPage;
      }),
    );
    return { pages };
  }

  private async findHtmlFiles(root: string, cumulative: string[] = []): Promise<string[]> {
    if (cumulative.length >= MAX_PAGES) return cumulative;
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return cumulative;
    }
    for (const entry of entries) {
      if (cumulative.length >= MAX_PAGES) break;
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) await this.findHtmlFiles(full, cumulative);
      else if (/\.html?$/i.test(entry.name)) cumulative.push(full);
    }
    return cumulative;
  }

  /**
   * Crawler protection from the spec: block local/private addresses (SSRF)
   * before any request leaves the machine.
   */

  //TODO: later support for localhost if time permits
  private async guardedFetch(url: string): Promise<Response> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Blocked non-HTTP protocol: ${parsed.protocol}`);
    }
    if (this.isForbiddenHost(parsed.hostname)) {
      throw new Error(`Blocked local or private address: ${parsed.hostname}`);
    }
    const resolved = await dns.lookup(parsed.hostname, { all: true });
    for (const { address } of resolved) {
      if (this.isForbiddenIp(address)) {
        throw new Error(`Blocked local or private address: ${address}`);
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { signal: controller.signal, redirect: 'follow' });
    } finally {
      clearTimeout(timer);
    }
  }

  private isForbiddenHost(hostname: string): boolean {
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
    if (net.isIP(hostname) !== 0) return this.isForbiddenIp(hostname);
    return false;
  }

  private isForbiddenIp(ip: string): boolean {
    if (net.isIP(ip) === 0) return false;
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') ||
        lower.startsWith('fe80') || lower.startsWith('::ffff:127.');
    }
    const parts = ip.split('.').map(Number);
    if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    return false;
  }
}
