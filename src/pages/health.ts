/** Liveness probe — `GET /health`, polled every 30s by the Docker HEALTHCHECK. */
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
