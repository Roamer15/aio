import { AuditRules } from '../shared';
import type { PageSignals } from './extractor.service';
import { RulesService } from './rules.service';

function page(overrides: Partial<PageSignals> = {}): PageSignals {
  return {
    pageUrl: '/index.html',
    file: '/project/index.html',
    title: 'A complete page title for SEO',
    metaDescription:
      'A sufficiently long description for this sample site and its visitors.',
    h1Count: 1,
    canonical: 'https://example.test/',
    openGraphComplete: true,
    ogTagCount: 3,
    twitterCardPresent: true,
    hreflangLangs: [],
    isSpaShell: false,
    images: [],
    ...overrides,
  };
}

describe('RulesService', () => {
  const rules = new RulesService();
  const site = { robotsTxtPresent: true, sitemapPresent: true };

  it('only checks hreflang when multiple target languages are declared', () => {
    const findings = rules.apply({
      pages: [page()],
      site,
      languages: [],
    });

    expect(
      findings.some((finding) => finding.rule === AuditRules.MissingHreflang),
    ).toBe(false);
  });

  it('matches language subtags and emits one hreflang finding per page', () => {
    const pages = [
      page({
        pageUrl: '/fr',
        hreflangLangs: ['fr-CM', 'en-GB'],
      }),
      page({
        pageUrl: '/en',
        hreflangLangs: ['fr-CM'],
      }),
    ];
    const findings = rules.apply({ pages, site, languages: ['fr', 'en'] });
    const hreflangFindings = findings.filter(
      (finding) => finding.rule === AuditRules.MissingHreflang,
    );

    expect(hreflangFindings).toHaveLength(1);
    expect(hreflangFindings[0].id).toBe(`${AuditRules.MissingHreflang}:/en`);
  });

  it('reports absent robots.txt once per site, not once per page or through meta tags', () => {
    const pages = [page(), page({ pageUrl: '/about' })];
    const findings = rules.apply({
      pages,
      site: { robotsTxtPresent: false, sitemapPresent: true },
      languages: [],
    });
    rules.applySiteRules(
      {
        pages,
        site: { robotsTxtPresent: false, sitemapPresent: true },
        languages: [],
      },
      findings,
      { file: '/project' },
    );

    expect(
      findings.filter((finding) => finding.rule === AuditRules.MissingRobots),
    ).toHaveLength(1);
    expect(
      findings.find((finding) => finding.rule === AuditRules.MissingRobots)
        ?.file,
    ).toBe('/project');
  });

  it('reports global image sizes once and keeps remote findings non-fixable', () => {
    const findings = rules.apply({
      pages: [page(), page({ pageUrl: '/about' })],
      site,
      imageSizes: new Map([['large.jpg', 400 * 1024]]),
      languages: [],
    });
    const heavyImageFindings = findings.filter(
      (finding) => finding.rule === AuditRules.HeavyImage,
    );
    const remoteFindings = rules.apply({
      pages: [page({ file: undefined, pageUrl: 'https://example.test/' })],
      site,
      languages: [],
    });

    expect(heavyImageFindings).toHaveLength(1);
    expect(
      remoteFindings.every((finding) => !finding.fixable && !finding.file),
    ).toBe(true);
    expect(
      remoteFindings.every(
        (finding) => finding.url === 'https://example.test/',
      ),
    ).toBe(true);
  });

  it('skips H1 and alt checks for an empty SPA shell', () => {
    const findings = rules.apply({
      pages: [
        page({
          isSpaShell: true,
          h1Count: 0,
          images: [{ src: 'hero.jpg', alt: null }],
        }),
      ],
      site,
      languages: [],
    });

    expect(
      findings.some((finding) => finding.rule === AuditRules.MissingH1),
    ).toBe(false);
    expect(
      findings.some((finding) => finding.rule === AuditRules.MissingAltText),
    ).toBe(false);
  });
});
