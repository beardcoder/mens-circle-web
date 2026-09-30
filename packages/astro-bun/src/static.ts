/**
 * Static files as Bun.serve routes. Unmatched methods (POST to a page), unknown paths
 * and the other trailing-slash form of a page fall through to the fetch handler, i.e.
 * to Astro, which redirects that form under `trailingSlash: 'always' | 'never'`.
 * Compression is left to the proxy in front.
 *
 * - Small files become static `Response` routes: held in memory, ETag,
 *   If-None-Match and HEAD handled natively by Bun.
 * - Large files become file routes: streamed with sendfile, Last-Modified natively.
 */
import { join } from 'node:path';
import { pageRoute, type RuntimeConfig, type StaticHeaders } from './shared';

export interface StaticRouteOptions extends Pick<RuntimeConfig, 'assets' | 'staticCacheControl' | 'trailingSlash'> {
  /** Absolute path of the client directory. */
  clientDir: string;
  /** Build-time overrides from the adapter's manifest. */
  headers: StaticHeaders;
  /** Files above this size are streamed from disk instead of held in memory. */
  maxBufferedSize?: number;
}

type StaticRoutes = Record<string, { GET: Response }>;

export interface StaticFiles {
  routes: StaticRoutes;
  /** The error pages by file path (`/404.html`), for Astro's `prerenderedErrorPageFetch`. */
  errorPages: Record<string, Response>;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';
const MAX_BUFFERED_SIZE = 1024 * 1024;
/** Prerendered error pages. They are served through Astro with their status, never as a 200 page. */
const ERROR_PAGE = /^\/(?:404|500)(?:\.html|\/index\.html)$/;

/**
 * The URL paths a file answers to: itself, and for a page the clean URL in the form
 * `trailingSlash` allows, both forms for `ignore`.
 */
export function urlPathsFor(file: string, trailingSlash: RuntimeConfig['trailingSlash']): string[] {
  const route = pageRoute(file);
  if (!route) return [file];
  if (route === '/' || trailingSlash === 'never') return [file, route];
  if (trailingSlash === 'always') return [file, `${route}/`];
  return [file, route, `${route}/`];
}

function headersFor(file: string, type: string, options: StaticRouteOptions): Headers {
  const headers = new Headers({
    'content-type': type,
    'cache-control': file.startsWith(`/${options.assets}/`) ? IMMUTABLE : options.staticCacheControl,
  });
  for (const [name, value] of Object.entries(options.headers[file] ?? {})) headers.set(name, value);
  // Text types get an explicit charset, also when an override names the type without one.
  const contentType = headers.get('content-type') ?? type;
  if (contentType.startsWith('text/') && !contentType.includes('charset')) {
    headers.set('content-type', `${contentType};charset=utf-8`);
  }
  return headers;
}

async function responseFor(file: string, options: StaticRouteOptions): Promise<Response> {
  const blob = Bun.file(join(options.clientDir, file));
  const headers = headersFor(file, blob.type, options);
  const buffered = blob.size <= (options.maxBufferedSize ?? MAX_BUFFERED_SIZE);
  return new Response(buffered ? await blob.bytes() : blob, { headers });
}

/** Every file below `clientDir` as a GET (and so HEAD) route, except the error pages. */
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
        const response = await responseFor(file, options);
        if (ERROR_PAGE.test(file)) {
          errorPages[file] = response;
          return;
        }
        for (const path of urlPathsFor(file, options.trailingSlash)) routes[path] = { GET: response };
      }),
  );
  return { routes, errorPages };
}
