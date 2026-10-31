import { Injectable, Logger } from '@nestjs/common';
import { AuditResult, Finding, Severity } from '../shared';
import { ExtractorService, PageSignals, SiteSignals } from './extractor.service';
import { FetcherService, LoadedPage } from './fetcher.service';
import { RulesService } from './rules.service';

/** Options accepted by the audit entry point. */
export interface AuditOptions {
  /** Remote site to audit. */
  url?: string;
  /** Local project folder to audit. */
  folder?: string;
  /** Primary languages the site targets (default: French and English). */
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
    const { pages, siteRoot } = await this.fetcher.loadPages(options);
    this.logger.log(`Auditing ${pages.length} page(s).`);

    const languages = options.languages ?? ['fr', 'en'];
    const pageSignals = pages.map((page) => this.extractor.extract(page));

    const site: SiteSignals = siteRoot
      ? await this.fetchSiteSignals(siteRoot)
      : await this.fetchFolderSiteSignals(pages);
    const imageSizes = await this.measureImageSizes(pageSignals, siteRoot);
    const findings = this.rules.apply({ pages: pageSignals, site, imageSizes, languages });
    this.rules.applySiteRules({ pages: pageSignals, site, imageSizes, languages }, findings, pageSignals[0]?.file ?? pageSignals[0]?.pageUrl ?? '');

    const score = this.score(findings);
    return { score, findings };
  }

  /** Re-score existing findings without re-crawling (cheap verification pass). */
  score(findings: Finding[]): number {
    const penalty = findings.reduce((sum, f) => sum + (SEVERITY_PENALTY[f.severity] ?? 0), 0);
    return Math.max(0, Math.min(100, 100 - penalty));
  }

  private async fetchSiteSignals(siteRoot: URL): Promise<SiteSignals> {
    const [robotsTxt, sitemap] = await Promise.all([
      this.fetcher.fetchSiteFile(siteRoot, 'robots.txt'),
      this.fetcher.fetchSiteFile(siteRoot, 'sitemap.xml'),
    ]);
    return { robotsTxtPresent: robotsTxt !== null, sitemapPresent: sitemap !== null };
  }

  private async fetchFolderSiteSignals(pages: LoadedPage[]): Promise<SiteSignals> {
    const root = pages[0]?.file ? pages[0].file.replace(/[/\\][^/\\]+$/, '') : null;
    if (!root) return { robotsTxtPresent: false, sitemapPresent: false };
    const [robotsTxt, sitemap] = await Promise.all([
      fsExists(`${root}/robots.txt`),
      fsExists(`${root}/sitemap.xml`),
    ]);
    return { robotsTxtPresent: robotsTxt, sitemapPresent: sitemap };
  }

  /**
   * Measure image weight without downloading pages: HEAD requests for remote
   * images (mobile data is expensive), file stat for local ones. Sizes are
   * only reported when actually measured; nothing is invented.
   */
  private async measureImageSizes(pageSignals: PageSignals[], siteRoot?: URL): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    const srcs = new Set(
      pageSignals.flatMap((p) => p.images.map((img) => img.src)).filter((src) => src.length > 0),
    );
    const limited = [...srcs].slice(0, 20);
    await Promise.all(
      limited.map(async (src) => {
        if (siteRoot) {
          const absolute = new URL(src, siteRoot);
          const size = await this.fetcher.contentLength(absolute.toString());
          if (size !== null) sizes.set(absolute.toString(), size);
          return;
        }
        // local folder: resolve the src against the page file's directory
        const page = pageSignals.find((p) => p.images.some((img) => img.src === src));
        if (page?.file && !/^[a-z][a-z0-9+.-]*:/i.test(src)) {
          try {
            const { stat } = await import('node:fs/promises');
            const path = await import('node:path');
            const file = path.resolve(path.dirname(page.file), decodeURIComponent(src.split('?')[0]));
            const info = await stat(file);
            sizes.set(src, info.size);
          } catch {
            // image missing on disk or absolute URL: skip, do not invent a size
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
