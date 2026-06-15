/**
 * Server entrypoint for the local "mens-circle-edge" adapter (see ./index.mjs).
 * Bundled into dist/server at build time and run by the Bun runtime.
 *
 * Serves the Astro site via astro/app's `App`: prerendered static files +
 * on-demand SSR, with security + Cache-Control headers. Also handles the API
 * routes via the embedded EmDash backend (bun:sqlite) — a single Bun process
 * replaces the former nginx + PocketBase + Astro three-process architecture.
 *
 * Astro auto-invokes `start(manifest, args)` from its generated entry, so
 * `bun run dist/server/entry.mjs` boots the server.
 */
import { App } from 'astro/app';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from '../server/api.ts';
import { startCron } from '../server/cron.ts';

// ── Headers (mirror the former nginx policy) ────────────────────────────────
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

/** Cache-Control by asset class. Content-hashed assets/fonts are immutable. */
function cacheControlFor(pathname) {
  if (pathname.startsWith('/assets/'))
    return 'public, max-age=31536000, immutable';
  if (/\.(?:woff2?|ttf|otf|eot)$/i.test(pathname))
    return 'public, max-age=31536000, immutable';
  if (/\.(?:avif|webp|jxl|png|jpe?g|gif|svg|ico)$/i.test(pathname))
    return 'public, max-age=604800';
  if (
    /\.xml$/i.test(pathname) ||
    /^\/(?:manifest\.(?:json|webmanifest)|robots\.txt|browserconfig\.xml)$/i.test(
      pathname,
    )
  )
    return 'public, max-age=86400';
  // HTML pages (and anything else): always revalidate.
  return 'public, max-age=0, must-revalidate';
}

/** Re-emit a response with security headers + a Cache-Control (if not already set). */
function withSiteHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', cacheControlFor(pathname));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Serve a prerendered HTML page / static asset from dist/client, or 404. */
async function serveStatic(pathname, clientDir) {
  const Bun = globalThis.Bun;
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    rel = pathname;
  }
  rel = rel.replace(/^\/+/, '');

  const candidates = [];
  if (rel && !pathname.endsWith('/'))
    candidates.push(path.join(clientDir, rel));
  candidates.push(path.join(clientDir, rel, 'index.html'));

  for (const file of candidates) {
    // Guard against path traversal (../) escaping the client dir.
    if (file !== clientDir && !file.startsWith(clientDir)) continue;
    const blob = Bun.file(file);
    if (await blob.exists())
      return withSiteHeaders(new Response(blob), pathname);
  }

  const notFound = Bun.file(path.join(clientDir, '404.html'));
  if (await notFound.exists()) {
    return new Response(notFound, {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...SECURITY_HEADERS,
      },
    });
  }
  return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });
}

/** Build the Astro request handler: API routes first, then on-demand SSR, falling back to static files. */
function createHandler(app, args) {
  const clientDir = fileURLToPath(args.client); // e.g. /app/dist/client/
  return async (request, server) => {
    const url = new URL(request.url);

    // EmDash API routes (replaces PocketBase)
    const apiResponse = await handleApiRequest(request, url);
    if (apiResponse) return apiResponse;

    const routeData = app.match(request);
    if (routeData) {
      const response = await app.render(request, {
        addCookieHeader: true,
        clientAddress: server?.requestIP?.(request)?.address,
        routeData,
      });
      return withSiteHeaders(response, url.pathname);
    }
    return serveStatic(url.pathname, clientDir);
  };
}

// ── Adapter exports ─────────────────────────────────────────────────────────
/** Astro calls this to build the exported handlers. */
export function createExports(manifest, args) {
  const app = new App(manifest);
  return { handle: createHandler(app, args) };
}

/**
 * Auto-invoked by Astro's generated entry: boots the EmDash server.
 *
 * This single Bun process serves everything: the Astro app (prerendered
 * files + on-demand SSR) AND the API routes backed by bun:sqlite. No nginx,
 * no PocketBase — one process, one binary, one port.
 */
export function start(manifest, args) {
  const Bun = globalThis.Bun;
  if (!Bun?.serve) {
    throw new Error(
      'mens-circle-edge must run in the Bun runtime (bun run …).',
    );
  }

  const app = new App(manifest);
  const handler = createHandler(app, args);
  const hostname = process.env.HOST || '0.0.0.0';
  const port = Number.parseInt(process.env.PORT || '4321', 10);

  const server = Bun.serve({
    hostname,
    port,
    idleTimeout: 120,
    fetch: (request, srv) => handler(request, srv),
  });

  // Start the background cron jobs (event reminders).
  startCron();

  console.log(`→ EmDash server listening on http://${hostname}:${port}`);

  const stop = () => {
    try {
      server.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  return server;
}
