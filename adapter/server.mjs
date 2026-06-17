/**
 * Server entrypoint for the local "mens-circle-edge" adapter (see ./index.mjs).
 * With `entrypointResolution: 'auto'` THIS module is the server entry: Astro
 * builds it to dist/server/entry.mjs, and `bun run dist/server/entry.mjs` runs
 * its top-level code to boot the server.
 *
 * Serves the Astro site via `createApp()` (astro/app/entrypoint, which wires in
 * the build-time manifest): prerendered static files + on-demand SSR, with
 * security + Cache-Control headers. It binds to loopback and does NOT proxy —
 * nginx is the public edge in front (it routes the PocketBase paths to
 * PocketBase and everything else here).
 */

import path from 'node:path';
// Build-time config (absolute dist/client path), injected by ./index.mjs.
import { clientDir } from 'virtual:mens-circle-edge/config';
import { createApp } from 'astro/app/entrypoint';

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

/** Build the Astro request handler: on-demand SSR, falling back to static files. */
function createHandler(app, clientDir) {
  return async (request, server) => {
    const url = new URL(request.url);
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

// ── Server boot ─────────────────────────────────────────────────────────────
// createApp() returns an `astro/app` App wired to the build-time manifest.
const app = createApp();

/** Astro request handler (exported for testing; the boot below uses it too). */
export const handle = createHandler(app, clientDir);

/**
 * Boot the Bun server when this module is run as the entry
 * (`bun run dist/server/entry.mjs`). Guarded so importing the module (e.g. in
 * tooling) doesn't start a server, and so a non-Bun runtime fails loudly.
 *
 * This process serves ONLY the Astro app (prerendered files + on-demand SSR).
 * nginx is the public edge in front of it: nginx routes the PocketBase paths
 * (/api, /_, /newsletter) straight to PocketBase and everything else here, so
 * this server binds to loopback and never proxies. SSR data is fetched from
 * PocketBase directly via PB_INTERNAL_URL (see src/lib/pocketbase-server.ts).
 */
const Bun = globalThis.Bun;
if (Bun?.serve) {
  const hostname = process.env.HOST || '0.0.0.0';
  const port = Number.parseInt(process.env.PORT || '4321', 10);

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
