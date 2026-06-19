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

// Security / SEO response headers are set by the edge proxy (Caddy via the
// Coolify proxy), not here, so this server just emits responses verbatim.

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
  if (rel && !pathname.endsWith('/')) candidates.push(path.join(clientDir, rel));
  candidates.push(path.join(clientDir, rel, 'index.html'));

  for (const file of candidates) {
    // Guard against path traversal escaping the client dir.
    if (file !== clientDir && !file.startsWith(clientDir)) continue;
    const blob = Bun.file(file);
    if (await blob.exists()) return new Response(blob);
  }

  const notFound = Bun.file(path.join(clientDir, '404.html'));
  if (await notFound.exists()) {
    return new Response(notFound, { status: 404 });
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
    return serveStatic(url.pathname, clientDir);
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
  });

  console.log(`→ Astro server listening on http://${hostname}:${port}`);

  const stop = () => {
    try {
      server.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} else {
  throw new Error('mens-circle-edge must run in the Bun runtime (bun run …).');
}
