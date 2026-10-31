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
    return ctx.pages.flatMap((page) => this.applyToPage(ctx, page));
  }

  private applyToPage(ctx: RuleContext, page: PageSignals): Finding[] {
    const findings: Finding[] = [];
    const at = page.file ?? page.pageUrl;

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
        file: at,
        evidence,
        fixable,
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

    if (page.h1Count === 0) {
      add(AuditRules.MissingH1, 'high', 'No <h1> heading found in the body.');
    } else if (page.h1Count > 1) {
      add(AuditRules.MissingH1, 'medium', `${page.h1Count} <h1> headings found on this page.`);
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

    if (!page.twitterTagCount.every(Boolean)) {
      add(
        AuditRules.MissingTwitterCard,
        'low',
        'Incomplete twitter:* meta tags (expected twitter:name, twitter:description, twitter:image).',
      );
    }

    const missingAlt = page.images.filter((img) => img.alt === null);
    if (missingAlt.length > 0) {
      add(
        AuditRules.MissingAltText,
        'medium',
        `${missingAlt.length} of ${page.images.length} images have no alt attribute (first: ${missingAlt[0].src || '<empty src>' }).`,
      );
    }

    if (!page.robotsMetaPresent && !ctx.site.robotsTxtPresent) {
      add(AuditRules.MissingRobots, 'low', 'No <meta name="robots"> tag and no robots.txt found.');
    }

    const langs = new Set(page.hreflangLangs);
    for (const lang of ctx.languages) {
      if (!langs.has(lang)) {
        add(
          AuditRules.MissingHreflang,
          'medium',
          `No hreflang "${lang}" alternate link found while the site targets ${ctx.languages.join(' and ')}.`,
        );
      }
    }

    if (ctx.imageSizes) {
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
  applySiteRules(ctx: RuleContext, findings: Finding[], rootAt: string): void {
    if (
      !ctx.site.robotsTxtPresent &&
      ctx.pages.every((p) => !p.robotsMetaPresent) &&
      !findings.some((f) => f.rule === AuditRules.MissingRobots)
    ) {
      findings.push({
        id: `${AuditRules.MissingRobots}:site`,
        rule: AuditRules.MissingRobots,
        severity: 'low',
        file: rootAt,
        evidence: 'robots.txt not found at the site root.',
        fixable: true,
      });
    }
    if (!ctx.site.sitemapPresent) {
      findings.push({
        id: `${AuditRules.MissingSitemap}:site`,
        rule: AuditRules.MissingSitemap,
        severity: 'medium',
        file: rootAt,
        evidence: 'sitemap.xml not found at the site root.',
        fixable: true,
      });
    }
  }
}
