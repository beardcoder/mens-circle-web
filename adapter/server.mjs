/**
 * Server entry for the local "mens-circle-edge" adapter (see ./index.mjs).
 * With `entrypointResolution: 'auto'` Astro builds this to dist/server/entry.mjs
 * and runs its top-level code. It is the container's single public edge: serves
 * static + SSR and proxies the PocketBase paths (/api, /_) to PB_INTERNAL_URL.
 */

import path from 'node:path';
import { clientDir } from 'virtual:mens-circle-edge/config';
import { createApp } from 'astro/app/entrypoint';

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

const PB_TARGET = (process.env.PB_INTERNAL_URL || 'http://127.0.0.1:8091').replace(/\/+$/, '');

/** Paths owned by PocketBase: REST API (/api/…) and admin UI (/_, /_/…). */
function ownedByPocketBase(pathname) {
  return pathname.startsWith('/api/') || pathname === '/_' || pathname.startsWith('/_/');
}

/** Forward a request to PocketBase, streaming the response straight back. */
async function proxyToPocketBase(request, url, clientAddress) {
  const headers = new Headers(request.headers);
  // `Host` is a forbidden fetch header — it's set from the target URL.
  const priorXff = headers.get('x-forwarded-for');
  if (clientAddress) {
    headers.set('x-forwarded-for', priorXff ? `${priorXff}, ${clientAddress}` : clientAddress);
    if (!headers.has('x-real-ip')) headers.set('x-real-ip', clientAddress);
  }
  if (!headers.has('x-forwarded-proto')) {
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
  }
  if (!headers.has('x-forwarded-host') && headers.has('host')) {
    headers.set('x-forwarded-host', headers.get('host'));
  }
  // Let fetch negotiate its own Accept-Encoding (gzip/deflate/br — all of which
  // it can decode) instead of forwarding the browser's, which may ask for an
  // encoding fetch won't decode (e.g. zstd) and leave the body still compressed.
  headers.delete('accept-encoding');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(`${PB_TARGET}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    redirect: 'manual',
  });

  // fetch transparently decodes the body (it always sends Accept-Encoding) but
  // leaves Content-Encoding/-Length on the response. Forwarding them verbatim
  // would tell the browser to gunzip already-plain bytes against a stale length
  // → ERR_CONTENT_DECODING_FAILED. Drop them; the decoded body is sent as-is.
  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete('content-encoding');
  respHeaders.delete('content-length');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

/** Proxy PocketBase paths; otherwise SSR, falling back to static files. */
function createHandler(app, clientDir) {
  return async (request, server) => {
    const url = new URL(request.url);
    const clientAddress = server?.requestIP?.(request)?.address;

    if (ownedByPocketBase(url.pathname)) {
      return proxyToPocketBase(request, url, clientAddress);
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
