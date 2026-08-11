/**
 * Liveness probe — `GET /health`, polled every 30s by the Docker HEALTHCHECK.
 * The cheapest possible 200: answering at all proves the request loop is up.
 *
 * Deliberately no DB query. Migrations run at boot, so a process answering
 * requests already has a schema, and probing one would let a transient SQLite
 * lock restart a healthy container.
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
