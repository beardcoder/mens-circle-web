/**
 * Server entrypoint for the local "mens-circle-edge" adapter (see ./index.mjs).
 * Bundled into dist/server at build time and run by the Bun runtime.
 *
 *   Bun.serve (:8090, the exposed port)
 *   ├─ serves the Astro site: prerendered static files + on-demand SSR
 *   │  (via astro/app's `App`), with security + Cache-Control headers
 *   └─ reverse-proxies the dynamic PocketBase paths to loopback:
 *        /api/*  ·  /_  ·  /_/*  ·  /newsletter/*
 *
 * Astro auto-invokes `start(manifest, args)` from its generated entry, so
 * `bun run dist/server/entry.mjs` boots the whole edge.
 */
import { App } from 'astro/app';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
function createHandler(app, args) {
  const clientDir = fileURLToPath(args.client); // e.g. /app/dist/client/
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

// ── PocketBase reverse proxy ────────────────────────────────────────────────
/** Paths owned by PocketBase (REST API, admin UI, newsletter-unsubscribe page). */
function isPocketBasePath(pathname) {
  return (
    pathname === '/_' ||
    pathname.startsWith('/_/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/newsletter/')
  );
}

/** Reverse-proxy a request to PocketBase, streaming the response straight back. */
async function proxyToPocketBase(request, server, pbUrl) {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);

  // Recover the real client IP for PocketBase's rate limiting (config.pb.js
  // trusts the leftmost X-Forwarded-For), keeping Coolify's chain and adding us.
  const peer = server?.requestIP?.(request)?.address;
  if (peer) {
    const prior = headers.get('X-Forwarded-For');
    headers.set('X-Forwarded-For', prior ? `${prior}, ${peer}` : peer);
  }
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-Forwarded-Host', url.host);

  const init = {
    method: request.method,
    headers,
    redirect: 'manual', // pass PocketBase's redirects through verbatim
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half'; // required to stream a request body
  }

  try {
    // Returned directly so all upstream headers (incl. multiple Set-Cookie)
    // and the streamed body are preserved unchanged.
    return await fetch(`${pbUrl}${url.pathname}${url.search}`, init);
  } catch {
    return new Response('Bad Gateway', { status: 502 });
  }
}

// ── Adapter exports ─────────────────────────────────────────────────────────
/** Astro calls this to build the exported handlers. */
export function createExports(manifest, args) {
  const app = new App(manifest);
  return { handle: createHandler(app, args) };
}

/** Auto-invoked by Astro's generated entry: boots the Bun edge server. */
export function start(manifest, args) {
  const Bun = globalThis.Bun;
  if (!Bun?.serve) {
    throw new Error(
      'mens-circle-edge must run in the Bun runtime (bun run …).',
    );
  }

  const app = new App(manifest);
  const handler = createHandler(app, args);
  const pbUrl = (
    process.env.PB_INTERNAL_URL || 'http://127.0.0.1:8091'
  ).replace(/\/$/, '');
  const hostname = process.env.HOST || '0.0.0.0';
  const port = Number.parseInt(process.env.PORT || '8090', 10);

  const server = Bun.serve({
    hostname,
    port,
    idleTimeout: 120, // accommodate PocketBase admin's SSE/realtime stream
    fetch(request, srv) {
      const { pathname } = new URL(request.url);
      return isPocketBasePath(pathname)
        ? proxyToPocketBase(request, srv, pbUrl)
        : handler(request, srv);
    },
  });

  console.log(
    `→ Edge listening on http://${hostname}:${port} (PocketBase: ${pbUrl})`,
  );

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
