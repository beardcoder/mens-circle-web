/** Public mail fonts: the external listmonk browser view needs cross-origin font access. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { APIRoute } from 'astro';

const fonts = new Set(['dm-sans.woff2', 'playfair-display-400.woff2', 'playfair-display-400-italic.woff2']);

export const GET: APIRoute = async ({ params, cache }) => {
  const font = params.font ?? '';

  if (!fonts.has(font)) return new Response(null, { status: 404 });

  const body = await readFile(resolve('src/assets/mail', font));

  cache.set({ maxAge: 604800 });

  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'font/woff2',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=604800',
    },
  });
};
