import { expect, test } from 'bun:test';
import { compressResponse, preferredEncoding } from '../src/compress';

const html = `<!doctype html>${'<p>Männerkreis</p>'.repeat(200)}`;
const request = (acceptEncoding: string, method = 'GET') =>
  new Request('http://localhost/event', { method, headers: { 'accept-encoding': acceptEncoding } });
const page = (headers: Record<string, string> = {}, status = 200) =>
  new Response(html, { status, headers: { 'content-type': 'text/html', ...headers } });

test('zstd is preferred, then gzip, and q=0 refuses', () => {
  expect(preferredEncoding(request('gzip, deflate, br, zstd'))).toBe('zstd');
  expect(preferredEncoding(request('gzip, zstd;q=0'))).toBe('gzip');
  expect(preferredEncoding(request('br, identity'))).toBeNull();
});

test('rendered HTML is compressed and decodes to the same bytes', async () => {
  const zstd = compressResponse(request('zstd'), page());
  expect(zstd.headers.get('content-encoding')).toBe('zstd');
  expect(new TextDecoder().decode(Bun.zstdDecompressSync(await zstd.bytes()))).toBe(html);

  const gzip = compressResponse(request('gzip'), page());
  expect(gzip.headers.get('content-encoding')).toBe('gzip');
  expect(new TextDecoder().decode(Bun.gunzipSync(await gzip.bytes()))).toBe(html);
});

test('status, cookies and caching headers survive; the ETag turns weak', () => {
  const headers = new Headers({ 'content-type': 'text/html', etag: '"abc"', vary: 'cookie' });
  headers.append('set-cookie', 'a=1');
  headers.append('set-cookie', 'b=2');
  const response = compressResponse(request('gzip'), new Response(html, { status: 404, headers }));
  expect(response.status).toBe(404);
  expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
  expect(response.headers.get('etag')).toBe('W/"abc"');
  expect(response.headers.get('vary')).toBe('cookie, accept-encoding');
  expect(response.headers.get('content-length')).toBeNull();
});

test('Vary names accept-encoding once', () => {
  const response = compressResponse(request('gzip'), page({ vary: 'Accept-Encoding' }));
  expect(response.headers.get('vary')).toBe('Accept-Encoding');
});

test('a streamed page stays streamed: the head arrives before the body ends', async () => {
  let finish!: () => void;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(new TextEncoder().encode(`<head>${'x'.repeat(2000)}</head>`));
      await new Promise<void>((resolve) => (finish = resolve));
      controller.enqueue(new TextEncoder().encode('<body></body>'));
      controller.close();
    },
  });
  const response = compressResponse(request('gzip'), new Response(body, { headers: { 'content-type': 'text/html' } }));
  const reader = response.body!.getReader();
  const first = await reader.read();
  expect(first.value!.byteLength).toBeGreaterThan(10);
  finish();
  while (!(await reader.read()).done);
});

test('left alone: HEAD, small, binary, already encoded, no-transform, event streams, 304', () => {
  const cases: Array<[Request, Response]> = [
    [request('gzip', 'HEAD'), page()],
    [request('gzip'), page({ 'content-length': '10' })],
    [request('gzip'), new Response(html, { headers: { 'content-type': 'image/png' } })],
    [request('gzip'), page({ 'content-encoding': 'br' })],
    [request('gzip'), page({ 'cache-control': 'no-transform' })],
    [request('gzip'), new Response(html, { headers: { 'content-type': 'text/event-stream' } })],
    [request('gzip'), new Response(null, { status: 304, headers: { 'content-type': 'text/html' } })],
    [request('identity'), page()],
  ];
  for (const [req, res] of cases) expect(compressResponse(req, res)).toBe(res);
});
