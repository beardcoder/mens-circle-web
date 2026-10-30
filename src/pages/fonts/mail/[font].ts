/** Public mail fonts: the external listmonk browser view needs cross-origin font access. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { APIRoute } from 'astro';

const fonts = new Set(['dm-sans.woff2', 'playfair-display-400.woff2', 'playfair-display-400-italic.woff2']);

// Read per request (rare: only mail views load them) instead of held in the route cache.
export const GET: APIRoute = async ({ params }) => {
  const font = params.font ?? '';

  if (!fonts.has(font)) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(await readFile(resolve('src/assets/mail', font))), {
    headers: {
      'Content-Type': 'font/woff2',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
    },
  });
};
