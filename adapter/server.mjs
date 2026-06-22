/**
 * Server entry for the local "mens-circle-edge" adapter (see ./index.mjs).
 * With `entrypointResolution: 'auto'` Astro builds this to dist/server/entry.mjs
 * and runs its top-level code. It is the container's single public edge: it
 * serves static assets + on-demand SSR, including the API routes (/api/*) and
 * the admin UI, which are now plain Astro endpoints backed by the in-process
 * Drizzle/SQLite data layer (no external backend to proxy).
 */

import path from 'node:path';
import { clientDir } from 'virtual:mens-circle-edge/config';
import { createApp } from 'astro/app/entrypoint';

// Mark that we're in the live Bun runtime (not the build-time prerender). The
// middleware reads this before lazily starting the reminder cron / touching the
// `bun:sqlite` data layer, so the build never loads bun: modules.
globalThis.__MC_RUNTIME = true;

// Security / SEO response headers (CSP, HSTS, etc.) are set by the edge proxy
// (Caddy via the Coolify proxy), not here. Caching is the one response concern
// this server owns: it alone knows which files are content-hashed (and thus
// immutable) versus which must be revalidated on each deploy — see the README
// architecture box ("gehashte Assets immutable").

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Cache-Control for a static file, keyed off its path within dist/client.
 * `assets/` holds Astro's content-hashed build output (JS/CSS/fonts) — the URL
 * changes whenever the bytes change, so it is safe to cache forever. Everything
 * else (prerendered HTML, favicons, manifest, robots, images) keeps its URL
 * across deploys, so it must be revalidated; the ETag/304 path below makes that
 * cheap. The service worker is never cached, so updates take effect at once.
 */
function cacheControlFor(rel) {
  if (rel.startsWith('assets/')) return `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
  if (rel === 'sw.js') return 'no-cache';
  return 'public, max-age=0, must-revalidate';
}

/**
 * Build a cacheable Response for a BunFile, honouring conditional requests.
 * A weak ETag from size + mtime lets revalidating clients get a 304 (empty
 * body) instead of re-downloading unchanged HTML/images. `rel` is the file's
 * path within dist/client (drives Cache-Control); `status` is 200 or 404.
 */
function fileResponse(blob, rel, request, status) {
  const mtimeMs = blob.lastModified;
  const etag = `W/"${blob.size.toString(16)}-${mtimeMs.toString(16)}"`;
  const headers = {
    'cache-control': cacheControlFor(rel),
    etag,
    'last-modified': new Date(mtimeMs).toUTCString(),
  };
  if (status === 200 && request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(blob, { status, headers });
}

/** Serve a prerendered HTML page / static asset from dist/client, or 404. */
async function serveStatic(pathname, clientDir, request) {
  const Bun = globalThis.Bun;
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    rel = pathname;
  }
  rel = rel.replace(/^\/+/, '');

  const candidates = [];
  if (rel && !pathname.endsWith('/')) candidates.push({ file: path.join(clientDir, rel), rel });
  const indexRel = `${rel.replace(/\/+$/, '')}${rel ? '/' : ''}index.html`;
  candidates.push({ file: path.join(clientDir, rel, 'index.html'), rel: indexRel });

  for (const { file, rel: fileRel } of candidates) {
    // Guard against path traversal escaping the client dir.
    if (file !== clientDir && !file.startsWith(clientDir)) continue;
    const blob = Bun.file(file);
    if (await blob.exists()) return fileResponse(blob, fileRel, request, 200);
  }

  const notFound = Bun.file(path.join(clientDir, '404.html'));
  if (await notFound.exists()) {
    return fileResponse(notFound, '404.html', request, 404);
  }
  return new Response('Not found', { status: 404 });
}

/** SSR with a static-file fallback. The API (/api/*) is handled by Astro now. */
function createHandler(app, clientDir) {
  return async (request, server) => {
    const url = new URL(request.url);
    const clientAddress = server?.requestIP?.(request)?.address;

    // Liveness probe (Coolify / Docker HEALTHCHECK). Answered by the edge itself,
    // before any SSR render — a 200 confirms the Bun server is accepting and
    // serving requests, with zero dependency on the render pipeline (which is
    // what can stall over time under --smol).
    if (url.pathname === '/health') {
      return new Response('OK', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    const routeData = app.match(request);
    if (routeData) {
      return app.render(request, {
        addCookieHeader: true,
        clientAddress,
        routeData,
      });
    }
    return serveStatic(url.pathname, clientDir, request);
  };
}

const app = createApp();

/** Exported for testing; the boot below uses it too. */
export const handle = createHandler(app, clientDir);

// Boot when run as the entry (`bun run dist/server/entry.mjs`); guarded so a
// bare import doesn't start a server and a non-Bun runtime fails loudly.
const Bun = globalThis.Bun;
if (Bun?.serve) {
  const hostname = process.env.HOST || '0.0.0.0';
  const port = Number.parseInt(process.env.PORT || '8090', 10);

  const server = Bun.serve({
    hostname,
    port,
    idleTimeout: 120,
    fetch: (request, srv) => handle(request, srv),
    // Last-resort handler: a throw inside fetch/render returns a controlled 500
    // (and is logged to stderr for Coolify) instead of tearing down the socket.
    error(err) {
      console.error('[server] unhandled request error', err);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    },
  });

  console.log(`→ Astro server listening on http://${hostname}:${port}`);

  // Graceful shutdown: stop accepting new connections and let in-flight requests
  // drain before exiting, so a deploy/restart never cuts off a live request.
  let shuttingDown = false;
  const stop = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await server.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} else {
  throw new Error('mens-circle-edge must run in the Bun runtime (bun run …).');
}
