/**
 * GET /api/public/events/{slug}/ics — hosted iCalendar download for a published
 * event. The confirmation / promotion emails link here.
 */
import type { APIRoute } from 'astro';
import { getServices } from '../../../../../server/container';
import { buildIcs } from '../../../../../server/ics';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { events } = getServices();
  const ev = params.slug ? await events.rowBySlug(params.slug) : null;
  if (!ev) return new Response('Not found', { status: 404 });

  const ics = buildIcs(ev);
  if (!ics) return new Response('Not found', { status: 404 });

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="termin-${params.slug}.ics"`,
    },
  });
};
