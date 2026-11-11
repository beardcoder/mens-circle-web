/**
 * The production server: Bun.serve() around the handler that
 * @igloczek/astro-bun-adapter builds (`dist/server/entry.mjs`, standalone mode with
 * its autostart off). It serves like the adapter's own server (hashed `/assets/`
 * immutable, ETag/304, ranges, dotfiles and traversal refused) and adds a cache header:
 * a file without a Cache-Control of its own (prerendered pages, robots.txt, sw.js,
 * sitemaps) gets `public, max-age=0`, so browsers and Cloudflare revalidate it, as
 * they did under the Node adapter. Rendered pages bring theirs (lib/cache-policy.ts).
 * Every response also gets the security headers below.
 */
interface Context {
  clientAddress?: string;
  serverPort?: number;
}

interface Entry {
  handler: (request: Request, context: Context) => Promise<Response>;
  options: { bodySizeLimit?: number; idleTimeout?: number; shutdownTimeout?: number };
}

process.env.ASTRO_BUN_AUTOSTART = 'disabled';

const entry = new URL('./dist/server/entry.mjs', import.meta.url).href;
const { handler, options } = (await import(entry)) as Entry;

const REVALIDATE = 'public, max-age=0';

/**
 * Headers every response gets unless it set its own. The page CSP (script and style
 * hashes, allowed hosts) comes from Astro (astro.config.mjs): a header on rendered
 * pages, a <meta> on prerendered ones. A <meta> cannot forbid framing, so that part
 * travels here as a second policy. Back office and sign-in get a
 * complete, stricter policy without third-party hosts; a browser enforces both.
 */
const BASE_CSP = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "form-action 'self'",
  BASE_CSP,
].join('; ');

const PRIVATE_PATH = /^\/(?:admin|auth)(?:\/|$)/;

const securityHeaders = (pathname: string): Record<string, string> => ({
  'content-security-policy': PRIVATE_PATH.test(pathname) ? ADMIN_CSP : BASE_CSP,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
});

const finish = (response: Response, pathname: string): Response => {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(securityHeaders(pathname))) {
    // A second CSP header is a second policy: the browser enforces both, so Astro's
    // own (rendered pages) keeps its hashes and gains these restrictions.
    if (name === 'content-security-policy') headers.append(name, value);
    else if (!headers.has(name)) headers.set(name, value);
  }

  // A file without a Cache-Control of its own is revalidated (see the top).
  if (!headers.has('cache-control') && [200, 206, 304].includes(response.status)) {
    headers.set('cache-control', REVALIDATE);
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

/**
 * One second of route-cache hits, kept as bytes. A hit through the adapter still costs
 * its file lookups and a streamed body; under a burst that is the whole capacity of
 * the process. Keyed by path like the route cache (which ignores query and cookies),
 * emptied by every request that can write, so a purge is at most one second late.
 */
const HIT_TTL_MS = 1000;
const MAX_HITS = 64;
const hits = new Map<string, { until: number; headers: Headers; body: ArrayBuffer }>();

const hostname = process.env.HOST ?? 'localhost';

const server = Bun.serve({
  hostname,
  port: Number(process.env.PORT ?? 4321),
  ...(options.idleTimeout !== undefined && { idleTimeout: options.idleTimeout }),
  ...(options.bodySizeLimit !== undefined && { maxRequestBodySize: options.bodySizeLimit }),
  async fetch(request, bun) {
    const { pathname } = new URL(request.url);
    const isGet = request.method === 'GET';
    const hot = isGet ? hits.get(pathname) : undefined;

    if (hot && hot.until > Date.now()) return new Response(hot.body, { headers: hot.headers });

    const clientAddress = bun.requestIP(request)?.address;
    const response = finish(await handler(request, { clientAddress, serverPort: bun.port }), pathname);

    // An action may have purged the route cache.
    if (!isGet && request.method !== 'HEAD') hits.clear();

    if (!isGet || response.status !== 200 || response.headers.get('x-astro-cache') !== 'HIT') return response;

    const body = await response.arrayBuffer();

    if (hits.size >= MAX_HITS) hits.clear();

    hits.set(pathname, { until: Date.now() + HIT_TTL_MS, headers: response.headers, body });

    return new Response(body, { headers: response.headers });
  },
  error(error) {
    console.error(error);

    return new Response('Internal Server Error', { status: 500 });
  },
});

console.info(`Server listening on http://${hostname}:${server.port}`);

// Finish in-flight requests on SIGTERM (Coolify) or SIGINT, then exit; give up after
// the adapter's shutdown timeout.
let stopping = false;

const shutdown = (): void => {
  if (stopping) return;

  stopping = true;
  setTimeout(() => process.exit(1), (options.shutdownTimeout ?? 60) * 1000).unref();
  void server.stop().then(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
