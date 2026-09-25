import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acceptedEncodings, createStaticRoutes, urlPathsFor } from '../src/static';

test('pages answer to their clean URL too', () => {
  expect(urlPathsFor('/index.html')).toEqual(['/index.html', '/']);
  expect(urlPathsFor('/impressum/index.html')).toEqual(['/impressum/index.html', '/impressum']);
  expect(urlPathsFor('/about.html')).toEqual(['/about.html', '/about']);
  expect(urlPathsFor('/robots.txt')).toEqual(['/robots.txt']);
});

test('encodings refused with q=0 are not accepted', () => {
  expect([...acceptedEncodings('gzip, deflate, br, zstd')]).toEqual(['gzip', 'deflate', 'br', 'zstd']);
  expect(acceptedEncodings('zstd;q=0, gzip;q=0.5').has('zstd')).toBe(false);
  expect(acceptedEncodings('zstd;q=0, gzip;q=0.5').has('gzip')).toBe(true);
  expect(acceptedEncodings(null).size).toBe(0);
});

describe('served over HTTP', () => {
  let dir: string;
  let server: ReturnType<typeof Bun.serve>;
  const html = `<!doctype html><title>x</title>${'<p>Männerkreis</p>'.repeat(200)}`;
  const url = (path: string) => new URL(path, server.url);

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'astro-bun-'));
    await mkdir(join(dir, 'assets'));
    await mkdir(join(dir, 'impressum'));
    await writeFile(join(dir, 'impressum/index.html'), html);
    await writeFile(join(dir, 'assets/app.abc123.js'), 'console.log(1)');
    await writeFile(join(dir, 'robots.txt'), 'User-agent: *');
    await writeFile(join(dir, 'big.bin'), new Uint8Array(64 * 1024));

    const routes = await createStaticRoutes({
      clientDir: dir,
      assets: 'assets',
      staticCacheControl: 'public, max-age=60',
      compress: true,
      headers: { '/robots.txt': { 'Cache-Control': 'no-cache' } },
      maxBufferedSize: 16 * 1024,
    });
    server = Bun.serve({ port: 0, routes, fetch: () => new Response('astro', { status: 418 }) });
  });

  afterAll(async () => {
    await server.stop(true);
    await rm(dir, { recursive: true, force: true });
  });

  test('text is negotiated: zstd, then gzip, then identity', async () => {
    const zstd = await fetch(url('/impressum'), { headers: { 'accept-encoding': 'gzip, zstd' }, decompress: false });
    expect(zstd.headers.get('content-encoding')).toBe('zstd');
    expect(zstd.headers.get('vary')).toBe('accept-encoding');
    expect(new TextDecoder().decode(Bun.zstdDecompressSync(await zstd.bytes()))).toBe(html);

    const gzip = await fetch(url('/impressum'), { headers: { 'accept-encoding': 'gzip' }, decompress: false });
    expect(gzip.headers.get('content-encoding')).toBe('gzip');
    expect(new TextDecoder().decode(Bun.gunzipSync(await gzip.bytes()))).toBe(html);

    const identity = await fetch(url('/impressum/index.html'), { headers: { 'accept-encoding': 'identity' } });
    expect(identity.headers.get('content-encoding')).toBeNull();
    expect(identity.headers.get('content-type')).toBe('text/html;charset=utf-8');
    expect(await identity.text()).toBe(html);
    expect(identity.headers.get('etag')).not.toBe(gzip.headers.get('etag'));
  });

  test('each variant revalidates against its own ETag', async () => {
    const headers = { 'accept-encoding': 'gzip' };
    const first = await fetch(url('/impressum'), { headers });
    const etag = first.headers.get('etag')!;
    const again = await fetch(url('/impressum'), { headers: { ...headers, 'if-none-match': etag } });
    expect(again.status).toBe(304);
    const other = await fetch(url('/impressum'), { headers: { 'accept-encoding': 'zstd', 'if-none-match': etag } });
    expect(other.status).toBe(200);
  });

  test('HEAD is answered for negotiated and static routes', async () => {
    for (const path of ['/impressum', '/robots.txt']) {
      const response = await fetch(url(path), { method: 'HEAD' });
      expect(response.status).toBe(200);
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
});
