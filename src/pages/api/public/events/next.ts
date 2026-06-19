import type { APIRoute } from 'astro';
import { fetchNextEvent } from '@lib/server/events';

export const prerender = false;

// GET /api/public/events/next — the next upcoming published event (or null).
export const GET: APIRoute = async () => {
  const event = await fetchNextEvent();
  return Response.json({ event });
};
