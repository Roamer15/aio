import { Injectable } from '@nestjs/common';
import { AuditRules, Finding, Severity } from '../shared';
import type { PageSignals, SiteSignals } from './extractor.service';

/** A rule turns extracted signals into findings backed by measured evidence. */
export interface RuleContext {
  pages: PageSignals[];
  site: SiteSignals;
  imageSizes?: Map<string, number>;
  languages: ('fr' | 'en')[];
}

const HEAVY_IMAGE_BYTES = 300 * 1024;

@Injectable()
export class RulesService {
  apply(ctx: RuleContext): Finding[] {
    return ctx.pages.flatMap((page, index) =>
      this.applyToPage(ctx, page, index === 0),
    );
  }

  private applyToPage(
    ctx: RuleContext,
    page: PageSignals,
    firstPage: boolean,
  ): Finding[] {
    const findings: Finding[] = [];

    const add = (
      rule: string,
      severity: Severity,
      evidence: string,
      fixable = true,
    ) =>
      findings.push({
        id: `${rule}:${page.pageUrl}`,
        rule,
        severity,
        file: page.file,
        url: page.file ? undefined : page.pageUrl,
        evidence,
        fixable: fixable && page.file !== undefined,
      });

    if (!page.title) {
      add(AuditRules.MissingTitle, 'high', 'No <title> element found in <head>.');
    } else if (page.title.length < 15) {
      add(AuditRules.MissingTitle, 'medium', `Title is only ${page.title.length} characters: "${page.title}".`);
    }

    if (!page.metaDescription) {
      add(AuditRules.MissingMetaDescription, 'high', 'No <meta name="description"> found.');
    } else if (page.metaDescription.length < 50) {
      add(
        AuditRules.MissingMetaDescription,
        'low',
        `Description is only ${page.metaDescription.length} characters.`,
      );
    }

    if (!page.isSpaShell) {
      if (page.h1Count === 0) {
        add(AuditRules.MissingH1, 'high', 'No <h1> heading found in the body.');
      } else if (page.h1Count > 1) {
        add(AuditRules.MissingH1, 'medium', `${page.h1Count} <h1> headings found on this page.`);
      }
    }

    if (!page.canonical) {
      add(AuditRules.MissingCanonical, 'medium', 'No <link rel="canonical"> found.');
    }

    if (!page.openGraphComplete) {
      add(
        AuditRules.MissingOpenGraph,
        'medium',
        `Incomplete Open Graph tags: ${page.ogTagCount} og:* meta tags found; WhatsApp previews need at least og:title, og:description and og:image.`,
      );
    }

    if (!page.twitterCardPresent) {
      add(
        AuditRules.MissingTwitterCard,
        'low',
        'No <meta name="twitter:card"> found.',
      );
    }

    const missingAlt = page.isSpaShell
      ? []
      : page.images.filter((img) => img.alt === null);
    if (missingAlt.length > 0) {
      add(
        AuditRules.MissingAltText,
        'medium',
        `${missingAlt.length} of ${page.images.length} images have no alt attribute (first: ${missingAlt[0].src || '<empty src>' }).`,
      );
    }

    const langs = new Set(
      page.hreflangLangs.map((lang) => lang.toLowerCase().split('-')[0]),
    );
    const targetLangs = [...new Set(ctx.languages)];
    const missingLangs = targetLangs.filter((lang) => !langs.has(lang));
    if (targetLangs.length > 1 && missingLangs.length > 0) {
      add(
        AuditRules.MissingHreflang,
        'medium',
        `No hreflang alternate for: ${missingLangs.join(', ')} (site targets ${targetLangs.join(' and ')}).`,
      );
    }

    if (firstPage && ctx.imageSizes) {
      const heavy = [...ctx.imageSizes.entries()].filter(([, size]) => size > HEAVY_IMAGE_BYTES);
      if (heavy.length > 0) {
        const first = heavy[0];
        add(
          AuditRules.HeavyImage,
          'medium',
          `${heavy.length} images exceed ${Math.round(HEAVY_IMAGE_BYTES / 1024)} KB, e.g. ${first[0]} (${Math.round(first[1] / 1024)} KB).`,
        );
      }
    }

    return findings;
  }

  /** Site-wide rules, checked once after pages are audited (robots.txt, sitemap.xml). */
  applySiteRules(
    ctx: RuleContext,
    findings: Finding[],
    location: { file?: string; url?: string },
  ): void {
    if (!ctx.site.robotsTxtPresent) {
      findings.push({
        id: `${AuditRules.MissingRobots}:site`,
        rule: AuditRules.MissingRobots,
        severity: 'low',
        ...location,
        evidence: 'robots.txt not found at the site root.',
        fixable: location.file !== undefined,
      });
    }
    if (!ctx.site.sitemapPresent) {
      findings.push({
        id: `${AuditRules.MissingSitemap}:site`,
        rule: AuditRules.MissingSitemap,
        severity: 'medium',
        ...location,
        evidence: 'sitemap.xml not found at the site root.',
        fixable: location.file !== undefined,
      });
    }
  }
}
