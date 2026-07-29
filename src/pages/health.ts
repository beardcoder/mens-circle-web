/**
 * Liveness probe — `GET /health`.
 *
 * The Docker HEALTHCHECK (and Coolify behind it) polls this every 30s. It must
 * be the cheapest possible 200: no page render, no template, no DB round-trip.
 * A response at all proves the Bun process is up and its request loop is
 * accepting — which is exactly what liveness means. Readiness of the data layer
 * is not probed on purpose: the migrations run during boot (see
 * lib/server/db/index.ts), so a process that reached the point of answering
 * requests already has a provisioned schema, and coupling the probe to a query
 * would let a transient SQLite lock restart a healthy container.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response('ok', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Never let a proxy or the browser serve a stale "ok".
      'cache-control': 'no-store',
    },
  });

// A HEAD probe (wget --spider, most orchestrators) must not fall through to the
// 404 route just because only GET is exported.
export const HEAD: APIRoute = () => new Response(null, { status: 200, headers: { 'cache-control': 'no-store' } });
