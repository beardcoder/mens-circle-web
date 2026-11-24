/** Readiness probe: `GET /health`, polled every 30 s by the Docker HEALTHCHECK. */
import type { APIRoute } from 'astro';
import { getEmDashCollection } from 'emdash';

export const prerender = false;

// Never let a proxy or the browser serve a stale answer.
const headers = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' };

/** `ok` only while the CMS database answers a query; a broken volume or file is a 503. */
const probe = async (): Promise<boolean> => {
  const { error } = await getEmDashCollection('events', { limit: 1 });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[health] database unavailable', String(error));
  }

  return !error;
};

export const GET: APIRoute = async () =>
  (await probe())
    ? new Response('ok', { status: 200, headers })
    : new Response('database unavailable', { status: 503, headers });

// A HEAD probe (wget --spider, most orchestrators) must not fall through to the
// 404 route just because only GET is exported.
export const HEAD: APIRoute = async () => new Response(null, { status: (await probe()) ? 200 : 503, headers });
