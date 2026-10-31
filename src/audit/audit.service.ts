import { Injectable, Logger } from '@nestjs/common';
import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import { AuditResult, Finding, Severity } from '../shared';
import {
  ExtractorService,
  PageSignals,
  SiteSignals,
} from './extractor.service';
import { FetcherService } from './fetcher.service';
import { RulesService } from './rules.service';

/** Options accepted by the audit entry point. */
export interface AuditOptions {
  /** Remote site to audit. */
  url?: string;
  /** Local project folder to audit. */
  folder?: string;
  /** Primary languages the site targets, when known. */
  languages?: ('fr' | 'en')[];
}

/** Penalty applied to the indicative score per finding severity. */
const SEVERITY_PENALTY: Record<Severity, number> = {
  high: 15,
  medium: 7,
  low: 3,
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly fetcher: FetcherService,
    private readonly extractor: ExtractorService,
    private readonly rules: RulesService,
  ) {}

  /**
   * Full audit pass: load pages, extract signals deterministically, apply
   * rules, and compute the indicative score. No model involved.
   */
  async audit(options: AuditOptions): Promise<AuditResult> {
    const { pages, siteRoot, rootDir } = await this.fetcher.loadPages(options);
    if (pages.length === 0) throw new Error('No HTML files found to audit.');
    this.logger.log(`Auditing ${pages.length} page(s).`);

    const languages = options.languages ?? [];
    const pageSignals = pages.map((page) => this.extractor.extract(page));

    const site: SiteSignals = siteRoot
      ? await this.fetchSiteSignals(siteRoot)
      : await this.fetchFolderSiteSignals(rootDir);
    const imageSizes = await this.measureImageSizes(pageSignals, siteRoot, rootDir);
    const findings = this.rules.apply({
      pages: pageSignals,
      site,
      imageSizes,
      languages,
    });
    this.rules.applySiteRules(
      { pages: pageSignals, site, imageSizes, languages },
      findings,
      rootDir ? { file: rootDir } : { url: siteRoot?.origin },
    );

    const score = this.score(findings);
    return { score, findings };
  }

  /** Re-score existing findings without re-crawling (cheap verification pass). */
  score(findings: Finding[]): number {
    const penalty = findings.reduce(
      (sum, f) => sum + (SEVERITY_PENALTY[f.severity] ?? 0),
      0,
    );
    return Math.max(0, Math.min(100, 100 - penalty));
  }

  private async fetchSiteSignals(siteRoot: URL): Promise<SiteSignals> {
    const [robotsTxt, sitemap] = await Promise.all([
      this.fetcher.fetchSiteFile(siteRoot, '/robots.txt'),
      this.fetcher.fetchSiteFile(siteRoot, '/sitemap.xml'),
    ]);
    return {
      robotsTxtPresent: robotsTxt !== null,
      sitemapPresent: sitemap !== null,
    };
  }

  private async fetchFolderSiteSignals(
    rootDir?: string,
  ): Promise<SiteSignals> {
    if (!rootDir) return { robotsTxtPresent: false, sitemapPresent: false };
    const has = async (name: string) =>
      (
        await Promise.all(
          [rootDir, path.join(rootDir, 'public')].map((directory) =>
            fsExists(path.join(directory, name)),
          ),
        )
      ).some(Boolean);
    const [robotsTxtPresent, sitemapPresent] = await Promise.all([
      has('robots.txt'),
      has('sitemap.xml'),
    ]);
    return { robotsTxtPresent, sitemapPresent };
  }

  /**
   * Measure image weight without downloading pages: HEAD requests for remote
   * images (mobile data is expensive), file stat for local ones. Sizes are
   * only reported when actually measured; nothing is invented.
   */
  private async measureImageSizes(
    pageSignals: PageSignals[],
    siteRoot?: URL,
    rootDir?: string,
  ): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    const srcs = new Set(
      pageSignals
        .flatMap((p) => p.images.map((img) => img.src))
        .filter((src) => src.length > 0),
    );
    const limited = [...srcs].slice(0, 20);
    await Promise.all(
      limited.map(async (src) => {
        if (siteRoot) {
          try {
            const absolute = new URL(src, siteRoot);
            const size = await this.fetcher.contentLength(absolute.toString());
            if (size !== null) sizes.set(absolute.toString(), size);
          } catch {
            // Ignore malformed image URLs; they do not invalidate the page audit.
          }
          return;
        }
        // local folder: resolve the src against the page file's directory
        const page = pageSignals.find((p) =>
          p.images.some((img) => img.src === src),
        );
        if (
          page?.file &&
          rootDir &&
          !/^[a-z][a-z0-9+.-]*:/i.test(src)
        ) {
          try {
            const decoded = decodeURIComponent(src.split(/[?#]/, 1)[0]);
            const base = src.startsWith('/') ? rootDir : path.dirname(page.file);
            const file = path.resolve(base, decoded);
            const relative = path.relative(rootDir, file);
            if (
              relative === '..' ||
              relative.startsWith(`..${path.sep}`) ||
              path.isAbsolute(relative)
            ) {
              return;
            }
            const info = await stat(file);
            if (info.isFile()) sizes.set(src, info.size);
          } catch {
            // Missing, malformed, or unreadable local images are not measured.
          }
        }
      }),
    );
    return sizes;
  }
}

async function fsExists(p: string): Promise<boolean> {
  try {
    const { access } = await import('node:fs/promises');
    await access(p);
    return true;
  } catch {
    return false;
  }
}
