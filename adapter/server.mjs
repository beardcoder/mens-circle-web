/**
 * Server entrypoint for the local "mens-circle-edge" adapter (see ./index.mjs).
 * With `entrypointResolution: 'auto'` THIS module is the server entry: Astro
 * builds it to dist/server/entry.mjs, and `bun run dist/server/entry.mjs` runs
 * its top-level code to boot the server.
 *
 * This single Bun process is the container's public edge (there is no nginx):
 *   • proxies the PocketBase-owned paths (/api, /_) to PocketBase on loopback,
 *   • serves prerendered static files + on-demand SSR for everything else,
 * all with security + Cache-Control headers. PocketBase stays on loopback;
 * SSR fetches it directly via PB_INTERNAL_URL (see src/lib/pocketbase-server.ts).
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

// ── PocketBase reverse proxy ─────────────────────────────────────────────────
// PocketBase listens on loopback; this process is the only thing the browser
// talks to, so it forwards the PocketBase-owned paths to it (same origin → no
// CORS). PB_INTERNAL_URL is the same env SSR uses (see pocketbase-server.ts).
const PB_TARGET = (
  process.env.PB_INTERNAL_URL || 'http://127.0.0.1:8091'
).replace(/\/+$/, '');

/** Paths owned by PocketBase: REST API (/api/…) and the admin UI (/_, /_/…). */
function ownedByPocketBase(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname === '/_' ||
    pathname.startsWith('/_/')
  );
}

/** Forward a request to PocketBase, streaming the response straight back. */
function proxyToPocketBase(request, url, clientAddress) {
  const headers = new Headers(request.headers);
  // Standard reverse-proxy hops so PocketBase sees the real client/scheme.
  // (`Host` is a forbidden fetch header and is set from the target URL.)
  const priorXff = headers.get('x-forwarded-for');
  if (clientAddress) {
    headers.set(
      'x-forwarded-for',
      priorXff ? `${priorXff}, ${clientAddress}` : clientAddress,
    );
    if (!headers.has('x-real-ip')) headers.set('x-real-ip', clientAddress);
  }
  if (!headers.has('x-forwarded-proto')) {
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
  }
  if (!headers.has('x-forwarded-host') && headers.has('host')) {
    headers.set('x-forwarded-host', headers.get('host'));
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return fetch(`${PB_TARGET}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
  });
}

/**
 * Build the request handler: PocketBase paths are proxied; everything else is
 * on-demand SSR, falling back to prerendered/static files.
 */
function createHandler(app, clientDir) {
  return async (request, server) => {
    const url = new URL(request.url);
    const clientAddress = server?.requestIP?.(request)?.address;

    if (ownedByPocketBase(url.pathname)) {
      return proxyToPocketBase(request, url, clientAddress);
    }

    const routeData = app.match(request);
    if (routeData) {
      const response = await app.render(request, {
        addCookieHeader: true,
        clientAddress,
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
 * This is the container's public edge: it serves the Astro app (prerendered
 * files + on-demand SSR) and proxies the PocketBase paths (see createHandler).
 * It binds to the exposed port (PORT, default 8090); PocketBase stays on
 * loopback and is reached via PB_INTERNAL_URL.
 */
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
