import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaticRoutes, urlPathsFor } from '../src/static';

test('pages answer to their clean URL in the configured trailing-slash form', () => {
  expect(urlPathsFor('/index.html', 'never')).toEqual(['/index.html', '/']);
  expect(urlPathsFor('/impressum/index.html', 'never')).toEqual(['/impressum/index.html', '/impressum']);
  expect(urlPathsFor('/impressum/index.html', 'always')).toEqual(['/impressum/index.html', '/impressum/']);
  expect(urlPathsFor('/impressum/index.html', 'ignore')).toEqual([
    '/impressum/index.html',
    '/impressum',
    '/impressum/',
  ]);
  expect(urlPathsFor('/about.html', 'never')).toEqual(['/about.html', '/about']);
  expect(urlPathsFor('/about.html', 'always')).toEqual(['/about.html', '/about/']);
  expect(urlPathsFor('/robots.txt', 'always')).toEqual(['/robots.txt']);
});

describe('served over HTTP', () => {
  let dir: string;
  let server: ReturnType<typeof Bun.serve>;
  const html = `<!doctype html><title>x</title>${'<p>Männerkreis</p>'.repeat(200)}`;
  const url = (path: string) => new URL(path, server.url);
  let errorPages: Awaited<ReturnType<typeof createStaticRoutes>>['errorPages'];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'astro-bun-'));
    await mkdir(join(dir, 'assets'));
    await mkdir(join(dir, 'impressum'));
    await writeFile(join(dir, 'impressum/index.html'), html);
    await writeFile(join(dir, 'assets/app.abc123.js'), 'console.log(1)');
    await writeFile(join(dir, 'robots.txt'), 'User-agent: *');
    await writeFile(join(dir, 'big.bin'), new Uint8Array(64 * 1024));
    await writeFile(join(dir, '404.html'), '<h1>404</h1>');

    const files = await createStaticRoutes({
      clientDir: dir,
      assets: 'assets',
      staticCacheControl: 'public, max-age=60',
      trailingSlash: 'never',
      headers: {
        '/robots.txt': { 'Cache-Control': 'no-cache' },
        // What Astro's routeToHeaders records for a prerendered page.
        '/impressum/index.html': { 'content-type': 'text/html' },
      },
      maxBufferedSize: 16 * 1024,
    });
    errorPages = files.errorPages;
    server = Bun.serve({ port: 0, routes: files.routes, fetch: () => new Response('astro', { status: 418 }) });
  });

  afterAll(async () => {
    await server.stop(true);
    await rm(dir, { recursive: true, force: true });
  });

  test('pages are served as is, with their clean URL and a charset', async () => {
    const response = await fetch(url('/impressum'), { headers: { 'accept-encoding': 'gzip, zstd' } });
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8');
    expect(await response.text()).toBe(html);
    expect(await (await fetch(url('/impressum/index.html'))).text()).toBe(html);
  });

  test('HEAD is answered natively', async () => {
    for (const path of ['/impressum', '/robots.txt']) {
      expect((await fetch(url(path), { method: 'HEAD' })).status).toBe(200);
    }
  });

  test('static responses get native ETags and the manifest headers', async () => {
    const response = await fetch(url('/robots.txt'));
    expect(response.headers.get('cache-control')).toBe('no-cache');
    const etag = response.headers.get('etag')!;
    expect(etag).toBeTruthy();
    expect((await fetch(url('/robots.txt'), { headers: { 'if-none-match': etag } })).status).toBe(304);
  });

  test('hashed assets are immutable, the rest gets the default', async () => {
    expect((await fetch(url('/assets/app.abc123.js'))).headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect((await fetch(url('/big.bin'))).headers.get('cache-control')).toBe('public, max-age=60');
  });

  test('large files are streamed from disk', async () => {
    const response = await fetch(url('/big.bin'));
    // Last-Modified instead of an ETag marks Bun's file route.
    expect(response.headers.get('last-modified')).toBeTruthy();
    expect((await response.bytes()).byteLength).toBe(64 * 1024);
  });

  test('other methods and unknown paths fall through to Astro', async () => {
    expect((await fetch(url('/impressum'), { method: 'POST' })).status).toBe(418);
    expect((await fetch(url('/robots.txt'), { method: 'POST' })).status).toBe(418);
    expect((await fetch(url('/impressum/'))).status).toBe(418);
    expect((await fetch(url('/missing'))).status).toBe(418);
  });

  test('error pages are kept for Astro, never served as a 200 page', async () => {
    expect((await fetch(url('/404'))).status).toBe(418);
    expect((await fetch(url('/404.html'))).status).toBe(418);
    const page = errorPages['/404.html'];
    expect(await page.clone().text()).toBe('<h1>404</h1>');
  });
});
