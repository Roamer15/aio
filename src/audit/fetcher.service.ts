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
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
]);

@Injectable()
export class FetcherService {
  private readonly logger = new Logger(FetcherService.name);

  async loadPages(
    target: AuditTarget,
  ): Promise<{ pages: LoadedPage[]; siteRoot?: URL; rootDir?: string }> {
    if (target.folder) return this.loadFolder(target.folder);
    if (target.url) return this.loadUrl(target.url);
    throw new Error(
      'Provide a url or a folder to audit (e.g. --url https://... or --folder ./site).',
    );
  }

  /** Load a site-level file (robots.txt, sitemap.xml) when auditing a URL. */
  async fetchSiteFile(siteRoot: URL, pathname: string): Promise<string | null> {
    try {
      const res = await this.guardedFetch(
        new URL(pathname, siteRoot).toString(),
      );
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  async contentLength(url: string): Promise<number | null> {
    try {
      const res = await this.guardedFetch(url, 'HEAD');
      const len = res.headers.get('content-length');
      if (!len) return null;
      const size = Number(len);
      return Number.isFinite(size) && size >= 0 ? size : null;
    } catch {
      return null;
    }
  }

  private async loadUrl(
    rawUrl: string,
  ): Promise<{ pages: LoadedPage[]; siteRoot: URL }> {
    const siteRoot = new URL(rawUrl);
    const res = await this.guardedFetch(siteRoot.toString());
    if (!res.ok) {
      throw new Error(`Failed to fetch ${siteRoot}: HTTP ${res.status}.`);
    }
    const html = await res.text();
    return { pages: [{ url: siteRoot.toString(), html }], siteRoot };
  }

  private async loadFolder(
    folder: string,
  ): Promise<{ pages: LoadedPage[]; rootDir: string }> {
    const root = path.resolve(folder);
    const files = await this.findHtmlFiles(root);
    const pages = await Promise.all(
      files.slice(0, MAX_PAGES).map(async (file) => {
        const html = await fs.readFile(file, 'utf8');
        const rel = path.relative(root, file).split(path.sep).join('/');
        return { url: `/${rel}`, file, html } satisfies LoadedPage;
      }),
    );
    return { pages, rootDir: root };
  }

  private async findHtmlFiles(
    root: string,
    cumulative: string[] = [],
  ): Promise<string[]> {
    if (cumulative.length >= MAX_PAGES) return cumulative;
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return cumulative;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (cumulative.length >= MAX_PAGES) break;
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await this.findHtmlFiles(full, cumulative);
        }
      } else if (/\.html?$/i.test(entry.name)) cumulative.push(full);
    }
    return cumulative;
  }

  /**
   * Crawler protection from the spec: block local/private addresses (SSRF)
   * before any request leaves the machine.
   */

  private async guardedFetch(
    url: string,
    method: 'GET' | 'HEAD' = 'GET',
  ): Promise<Response> {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const parsed = new URL(current);
      const hostname = this.assertPublicUrl(parsed);
      if (net.isIP(hostname) === 0) {
        const resolved = await dns.lookup(hostname, { all: true });
        for (const { address } of resolved) {
          if (this.isForbiddenIp(address)) {
            throw new Error(`Blocked local or private address: ${address}`);
          }
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(current, {
          method,
          signal: controller.signal,
          redirect: 'manual',
        });
        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
          await res.body?.cancel();
          if (hop === 4) throw new Error('Too many redirects.');
          current = new URL(location, current).toString();
          continue;
        }

        if (method === 'HEAD' || !res.body) return res;
        const body = await this.readLimitedBody(res.body);
        return new Response(body, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error('Too many redirects.');
  }

  private assertPublicUrl(parsed: URL): string {
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Blocked non-HTTP protocol: ${parsed.protocol}`);
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (this.isForbiddenHost(hostname)) {
      throw new Error(`Blocked local or private address: ${hostname}`);
    }
    return hostname;
  }

  private async readLimitedBody(
    body: ReadableStream<Uint8Array>,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error(
            `Response body exceeds the ${MAX_RESPONSE_BYTES} byte limit.`,
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const result = new Uint8Array(new ArrayBuffer(length));
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  private isForbiddenHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (net.isIP(host) !== 0) return this.isForbiddenIp(host);
    return false;
  }

  private isForbiddenIp(ip: string): boolean {
    if (net.isIP(ip) === 0) return false;
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      return (
        lower === '::' ||
        lower === '::1' ||
        lower.startsWith('::ffff:') ||
        lower.startsWith('fc') ||
        lower.startsWith('fd') ||
        lower.startsWith('fe8') ||
        lower.startsWith('fe9') ||
        lower.startsWith('fea') ||
        lower.startsWith('feb') ||
        lower.startsWith('ff') ||
        lower.startsWith('2001:db8:')
      );
    }
    const parts = ip.split('.').map(Number);
    if (
      parts[0] === 127 ||
      parts[0] === 10 ||
      parts[0] === 0 ||
      parts[0] >= 224
    )
      return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    return false;
  }
}
