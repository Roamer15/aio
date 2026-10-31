import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditService } from './audit.service';
import { ExtractorService } from './extractor.service';
import { FetcherService } from './fetcher.service';
import { RulesService } from './rules.service';

const cleanHtml = `<!doctype html>
<html lang="fr">
  <head>
    <title>LocalSEO sample page title</title>
    <meta name="description" content="A complete description that is long enough to explain this useful sample page.">
    <link rel="canonical" href="https://example.test/">
    <meta property="og:title" content="Sample title">
    <meta property="og:description" content="Sample description">
    <meta property="og:image" content="https://example.test/image.jpg">
    <meta name="twitter:card" content="summary_large_image">
  </head>
  <body><h1>Sample page</h1></body>
</html>`;

describe('AuditService', () => {
  let rootDir: string;
  let auditService: AuditService;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(os.tmpdir(), 'localseo-audit-'));
    auditService = new AuditService(
      new FetcherService(),
      new ExtractorService(),
      new RulesService(),
    );
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('gives a complete local page 100 when root files are present', async () => {
    await writeFile(path.join(rootDir, 'index.html'), cleanHtml);
    await writeFile(path.join(rootDir, 'robots.txt'), 'User-agent: *\n');
    await writeFile(path.join(rootDir, 'sitemap.xml'), '<urlset />');

    const result = await auditService.audit({ folder: rootDir });

    expect(result).toEqual({ score: 100, findings: [] });
  });

  it('finds site files in public/ and derives them from the project root', async () => {
    const pageDir = path.join(rootDir, 'src', 'pages');
    const publicDir = path.join(rootDir, 'public');
    await mkdir(pageDir, { recursive: true });
    await mkdir(publicDir, { recursive: true });
    await writeFile(path.join(pageDir, 'index.html'), cleanHtml);
    await writeFile(path.join(publicDir, 'robots.txt'), 'User-agent: *\n');
    await writeFile(path.join(publicDir, 'sitemap.xml'), '<urlset />');

    const result = await auditService.audit({ folder: rootDir });

    expect(result.findings).toEqual([]);
    expect(result.score).toBe(100);
  });

  it('rejects empty folders instead of returning a misleading score', async () => {
    await expect(auditService.audit({ folder: rootDir })).rejects.toThrow(
      'No HTML files found to audit.',
    );
  });
});
