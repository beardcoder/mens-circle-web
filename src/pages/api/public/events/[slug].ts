/** Live seats for the registration island; the page renders the same snapshot first. */
import type { APIRoute } from 'astro';

import { fetchEventState } from '@lib/server/events';
import { PUBLIC_CACHE, publicEvent } from '@lib/server/public-data';

const failure = (status: number, message: string): Response =>
  Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ params, cache }) => {
  const { status, event } = await fetchEventState(params.slug ?? '');

  if (status === 'not-found') return failure(404, 'Dieser Termin wurde nicht gefunden.');

  if (!event) return failure(503, 'Der Termin ist gerade nicht abrufbar.');

  cache.set(PUBLIC_CACHE);

  return Response.json(publicEvent(event), { headers: { 'X-Content-Type-Options': 'nosniff' } });
};
