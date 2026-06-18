/**
 * Server entry for the local "mens-circle-edge" adapter (see ./index.mjs).
 * With `entrypointResolution: 'auto'` Astro builds this to dist/server/entry.mjs
 * and runs its top-level code. It is the container's single public edge: serves
 * static + SSR. The backend (API, DB, email) is now in-process via the Astro
 * `/api/*` endpoints, so there is no PocketBase proxy anymore. A lightweight
 * interval drives the event-reminder cron by hitting the internal endpoint.
 */

import path from 'node:path';
import { clientDir } from 'virtual:mens-circle-edge/config';
import { createApp } from 'astro/app/entrypoint';

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
  return 'public, max-age=0, must-revalidate';
}

/** Re-emit a response with security headers + a Cache-Control (if unset). */
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
    // Guard against path traversal escaping the client dir.
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

/** SSR the request, falling back to static files from dist/client. */
function createHandler(app, clientDir) {
  return async (request, server) => {
    const url = new URL(request.url);
    const clientAddress = server?.requestIP?.(request)?.address;

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

  // Event-reminder cron: hit the internal endpoint every 15 minutes. Kept as an
  // HTTP call (not a direct import) so the exact same job is host-agnostic — an
  // external scheduler (e.g. a Cloudflare Cron Trigger) can drive it identically.
  // Guarded by CRON_SECRET; skipped entirely when it isn't configured.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const runReminders = async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:${port}/api/internal/cron/reminders`,
          {
            method: 'POST',
            // application/json is exempt from Astro's CSRF origin check (unlike
            // form content types), so this server-to-server call isn't blocked.
            headers: {
              'x-cron-secret': cronSecret,
              'Content-Type': 'application/json',
            },
          },
        );
        if (!res.ok) console.error(`✗ reminder cron returned ${res.status}`);
      } catch (err) {
        console.error('✗ reminder cron failed', String(err));
      }
    };
    setTimeout(runReminders, 30_000);
    setInterval(runReminders, 15 * 60 * 1000);
  } else {
    console.warn('→ CRON_SECRET unset — event-reminder cron disabled');
  }

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
