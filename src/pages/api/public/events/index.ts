/**
 * The upcoming dates as home and /event render them, for the `list-events` WebMCP
 * tool (lib/webmcp.ts): the same public view, never addresses or participant data.
 */
import type { APIRoute } from 'astro';

import { PUBLIC_CACHE, readPublicEvents } from '@lib/server/public-data';

export const GET: APIRoute = async ({ cache }) => {
  const events = await readPublicEvents();

  if (!events) {
    return Response.json(
      { message: 'Die Termine sind gerade nicht abrufbar.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  cache.set(PUBLIC_CACHE);

  return Response.json(events, { headers: { 'X-Content-Type-Options': 'nosniff' } });
};
