import type { APIRoute } from 'astro';

/** Compatibility tombstone. Never reads a source URL or transformation parameters. */
export const ALL: APIRoute = () =>
  new Response('Image transformations are disabled.', {
    status: 410,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
