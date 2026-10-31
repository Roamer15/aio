import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { FetcherService } from './fetcher.service';

describe('FetcherService', () => {
  let rootDir: string;
  let fetcher: FetcherService;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(os.tmpdir(), 'localseo-fetcher-'));
    fetcher = new FetcherService();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
  });

  it('skips generated and dependency directories and returns the project root', async () => {
    for (const directory of ['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage']) {
      const ignored = path.join(rootDir, directory);
      await mkdir(ignored);
      await writeFile(path.join(ignored, 'ignored.html'), '<h1>Ignored</h1>');
    }
    await writeFile(path.join(rootDir, 'index.html'), '<h1>Included</h1>');

    const loaded = await fetcher.loadPages({ folder: rootDir });

    expect(loaded.rootDir).toBe(rootDir);
    expect(loaded.pages.map((page) => page.file)).toEqual([
      path.join(rootDir, 'index.html'),
    ]);
  });

  it('blocks redirects to private addresses before making the redirected request', async () => {
    const request = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/private' },
        }),
      );

    await expect(fetcher.contentLength('http://8.8.8.8/image.jpg')).resolves.toBeNull();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('blocks hex-encoded IPv4-mapped IPv6 addresses before fetching', async () => {
    const request = jest.spyOn(globalThis, 'fetch');

    await expect(
      fetcher.contentLength('http://[::ffff:7f00:1]/image.jpg'),
    ).resolves.toBeNull();

    expect(request).not.toHaveBeenCalled();
  });

  it('rejects unsuccessful remote page responses', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('not found', { status: 404 }));

    await expect(
      fetcher.loadPages({ url: 'http://8.8.8.8/missing' }),
    ).rejects.toThrow('HTTP 404');
  });

  it('caps remote response bodies', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(5 * 1024 * 1024 + 1)),
    );

    await expect(
      fetcher.loadPages({ url: 'http://8.8.8.8/large' }),
    ).rejects.toThrow('Response body exceeds');
  });
});
