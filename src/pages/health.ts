import type { APIRoute } from 'astro';

// Liveness probe for the container orchestrator (Coolify / Docker HEALTHCHECK).
// Rendered on demand (NOT prerendered) so a 200 confirms the Bun server is
// actually accepting and serving requests — not just that a static file exists.
export const prerender = false;

export const GET: APIRoute = () =>
  new Response('OK', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
