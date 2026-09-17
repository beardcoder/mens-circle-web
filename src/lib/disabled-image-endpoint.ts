import type { APIRoute } from 'astro';

/** Astro always registers an image endpoint in SSR builds. Keep it inert. */
export const ALL: APIRoute = () => new Response(null, { status: 404 });
