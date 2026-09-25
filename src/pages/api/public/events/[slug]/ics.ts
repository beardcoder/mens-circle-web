import type { APIRoute } from 'astro';
import { getPublishedEventBySlug } from '@lib/server/events';
import { fullAddress } from '@lib/server/format';
import { buildIcs } from '@lib/server/ics';

export const prerender = false;

// GET /api/public/events/{slug}/ics — hosted iCalendar download, linked from the confirmation mails (`icsUrl`), so it carries the full address.
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) return new Response('Not found', { status: 404 });

  const event = await getPublishedEventBySlug(slug);
  if (!event) return new Response('Not found', { status: 404 });

  const ics = buildIcs({ ...event, location: [event.location, fullAddress(event)].filter(Boolean).join(', ') });
  if (!ics) return new Response('Not found', { status: 404 });

  return new Response(ics, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="termin-${slug}.ics"`,
    },
  });
};
