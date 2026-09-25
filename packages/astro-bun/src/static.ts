/**
 * Static files as Bun.serve routes. Unmatched methods (POST to a page) and unknown
 * paths fall through to the fetch handler, i.e. to Astro.
 *
 * - Small, incompressible files become static `Response` routes: held in memory,
 *   ETag, If-None-Match and HEAD handled natively by Bun.
 * - Compressible text is compressed once at startup (zstd, gzip) and negotiated per request.
 * - Large files become file routes: streamed with sendfile, Last-Modified and Range natively.
 */
import { join } from 'node:path';
import { acceptedEncodings, COMPRESSIBLE, MIN_COMPRESS_SIZE } from './compress';
import type { StaticHeaders } from './shared';

export interface StaticRouteOptions {
  clientDir: string;
  /** `build.assets`, the content-hashed directory. */
  assets: string;
  staticCacheControl: string;
  compress: boolean;
  /** Build-time overrides from the adapter's manifest. */
  headers: StaticHeaders;
  /** Files above this size are streamed from disk instead of held in memory. */
  maxBufferedSize?: number;
}

type Handler = (request: Request) => Response;
export type StaticRoutes = Record<string, { GET: Response | Handler; HEAD?: Handler }>;

const IMMUTABLE = 'public, max-age=31536000, immutable';
const MAX_BUFFERED_SIZE = 1024 * 1024;

/** The URL paths a file answers to: `/a/index.html` and `/a.html` also as `/a`. */
export function urlPathsFor(file: string): string[] {
  if (file.endsWith('/index.html')) return [file, file.slice(0, -'/index.html'.length) || '/'];
  if (file.endsWith('.html')) return [file, file.slice(0, -'.html'.length)];
  return [file];
}

const matchesETag = (header: string | null, etag: string): boolean =>
  !!header && (header.trim() === '*' || header.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag));

function headersFor(file: string, type: string, options: StaticRouteOptions): Headers {
  const headers = new Headers({
    'content-type': type.startsWith('text/') && !type.includes('charset') ? `${type}; charset=utf-8` : type,
    'cache-control': file.startsWith(`/${options.assets}/`) ? IMMUTABLE : options.staticCacheControl,
  });
  for (const [name, value] of Object.entries(options.headers[file] ?? {})) headers.set(name, value);
  return headers;
}

interface Variant {
  encoding: string | null;
  body: Uint8Array<ArrayBuffer>;
  headers: Headers;
}

/** zstd, then gzip, then identity; a variant is kept only if it saves at least a tenth. Runs once per file at startup, hence the high levels. */
function negotiated(bytes: Uint8Array<ArrayBuffer>, headers: Headers): Handler | null {
  const tag = Bun.hash(bytes).toString(36);
  const variant = (encoding: string | null, body: Uint8Array<ArrayBuffer>, suffix: string): Variant => {
    const own = new Headers(headers);
    own.set('etag', `"${tag}${suffix}"`);
    own.set('vary', 'accept-encoding');
    if (encoding) own.set('content-encoding', encoding);
    return { encoding, body, headers: own };
  };
  const encoded = [
    variant('zstd', new Uint8Array(Bun.zstdCompressSync(bytes, { level: 19 })), '-zst'),
    variant('gzip', Bun.gzipSync(bytes, { level: 9 }), '-gz'),
  ].filter(({ body }) => body.byteLength <= bytes.byteLength * 0.9);
  if (encoded.length === 0) return null;
  const identity = variant(null, bytes, '');

  return (request) => {
    const accepted = acceptedEncodings(request.headers.get('accept-encoding'));
    const { body, headers: own } = encoded.find(({ encoding }) => accepted.has(encoding!)) ?? identity;
    if (matchesETag(request.headers.get('if-none-match'), own.get('etag')!)) {
      return new Response(null, { status: 304, headers: own });
    }
    return new Response(body, { headers: own });
  };
}

async function routeFor(file: string, options: StaticRouteOptions): Promise<Response | Handler> {
  const blob = Bun.file(join(options.clientDir, file));
  const headers = headersFor(file, blob.type, options);
  if (blob.size > (options.maxBufferedSize ?? MAX_BUFFERED_SIZE)) return new Response(blob, { headers });

  const bytes = await blob.bytes();
  const compressible = options.compress && bytes.byteLength >= MIN_COMPRESS_SIZE && COMPRESSIBLE.test(blob.type);
  return (compressible && negotiated(bytes, headers)) || new Response(bytes, { headers });
}

/** Every file below `clientDir` as a GET and HEAD route, except the error pages. */
/** Prerendered error pages. They are served through Astro with their status, never as a 200 page. */
const ERROR_PAGE = /^\/(?:404|500)(?:\.html|\/index\.html)$/;

export interface StaticFiles {
  routes: StaticRoutes;
  /** The error pages by file path (`/404.html`), for Astro's `prerenderedErrorPageFetch`. */
  errorPages: Record<string, Response | Handler>;
}

export async function createStaticRoutes(options: StaticRouteOptions): Promise<StaticFiles> {
  const files = await Array.fromAsync(
    new Bun.Glob('**/*').scan({ cwd: options.clientDir, onlyFiles: true, dot: true }),
    (file) => `/${file.replaceAll('\\', '/')}`,
  );
  const routes: StaticRoutes = {};
  const errorPages: StaticFiles['errorPages'] = {};
  await Promise.all(
    files
      // `:` and `*` would turn a file name into a route pattern.
      .filter((file) => !/[:*]/.test(file))
      .map(async (file) => {
        const GET = await routeFor(file, options);
        if (ERROR_PAGE.test(file)) {
          errorPages[file] = GET;
          return;
        }
        // Bun answers HEAD for static responses itself, not for handlers.
        const route = typeof GET === 'function' ? { GET, HEAD: GET } : { GET };
        for (const path of urlPathsFor(file)) routes[path] = route;
      }),
  );
  return { routes, errorPages };
}
