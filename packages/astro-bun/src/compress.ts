/**
 * Content negotiation and on-the-fly compression for rendered (SSR) responses.
 *
 * CompressionStream buffers until the body ends, which would hold back a streamed page,
 * so this uses Bun's native node:zlib and flushes after every chunk Astro writes.
 */
import { once } from 'node:events';
import zlib from 'node:zlib';

export const COMPRESSIBLE =
  /^(?:text\/(?!event-stream)|application\/(?:javascript|json|xml|manifest\+json)|image\/svg\+xml)/;
export const MIN_COMPRESS_SIZE = 1024;

/** Encodings the client accepts, without the ones it refuses with `q=0`. */
export function acceptedEncodings(header: string | null): Set<string> {
  const accepted = new Set<string>();
  for (const part of (header ?? '').split(',')) {
    const [name, ...params] = part.split(';').map((token) => token.trim().toLowerCase());
    const q = params.find((param) => param.startsWith('q='));
    if (name && (!q || Number(q.slice(2)) > 0)) accepted.add(name);
  }
  return accepted;
}

/** zstd before gzip, like the precompressed static files. */
export function preferredEncoding(request: Request): 'zstd' | 'gzip' | null {
  const accepted = acceptedEncodings(request.headers.get('accept-encoding'));
  if (accepted.has('zstd')) return 'zstd';
  return accepted.has('gzip') ? 'gzip' : null;
}

function compressible(response: Response): boolean {
  const { headers, status, body } = response;
  const length = headers.get('content-length');
  return (
    !!body &&
    status !== 204 &&
    status !== 206 &&
    !headers.has('content-encoding') &&
    COMPRESSIBLE.test(headers.get('content-type') ?? '') &&
    !/\bno-transform\b/.test(headers.get('cache-control') ?? '') &&
    (length === null || Number(length) >= MIN_COMPRESS_SIZE)
  );
}

/** Pull-based, so backpressure reaches Astro; every chunk is flushed so streaming survives. */
function compressStream(body: ReadableStream<Uint8Array>, encoding: 'zstd' | 'gzip'): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const zip = encoding === 'zstd' ? zlib.createZstdCompress() : zlib.createGzip();
  const pending: Uint8Array[] = [];
  zip.on('data', (chunk: Uint8Array) => pending.push(chunk));
  // One chunk per flush: zlib emits header and data separately.
  const drain = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (pending.length > 0) controller.enqueue(Buffer.concat(pending.splice(0)));
  };

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        const ended = once(zip, 'end');
        zip.end();
        await ended;
        drain(controller);
        controller.close();
        return;
      }
      zip.write(value);
      await new Promise<void>((resolve) => zip.flush(() => resolve()));
      drain(controller);
    },
    cancel(reason) {
      zip.destroy();
      return reader.cancel(reason);
    },
  });
}

/** The response compressed for this request, or unchanged when it should not be. */
export function compressResponse(request: Request, response: Response): Response {
  const encoding = request.method === 'HEAD' ? null : preferredEncoding(request);
  if (!encoding || !compressible(response)) return response;

  const headers = new Headers(response.headers);
  headers.set('content-encoding', encoding);
  headers.delete('content-length');
  if (!/\baccept-encoding\b/i.test(headers.get('vary') ?? '')) headers.append('vary', 'accept-encoding');
  // Same resource, different bytes: a strong validator would now lie.
  const etag = headers.get('etag');
  if (etag && !etag.startsWith('W/')) headers.set('etag', `W/${etag}`);

  return new Response(compressStream(response.body!, encoding), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
