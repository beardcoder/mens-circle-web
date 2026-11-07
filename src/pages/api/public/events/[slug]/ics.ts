/**
 * `GET /api/public/events/<slug>/ics`: the evening as a calendar file. The event
 * page's "Apple/Outlook" button and the confirmation mails (`icsUrl`) link here.
 * Served `inline` from a real URL: iOS Safari hands a `text/calendar` response to
 * the Calendar app ("Hinzufügen"), but cannot open a `data:` link or honour
 * `download`. It carries the venue's full address, which the event page shows too.
 */
import type { APIRoute } from 'astro';

import { getPublishedEventBySlug } from '@lib/server/events';
import { buildIcs, calendarEventFrom } from '@lib/shared/ics';

export const prerender = false;

export const GET: APIRoute = async ({ params, site }) => {
  const slug = params.slug;
  const event = slug ? await getPublishedEventBySlug(slug) : null;
  const ics = event ? buildIcs(calendarEventFrom(event, site ?? 'https://mens-circle.de')) : '';

  if (!ics) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });

  return new Response(ics, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `inline; filename="maennerkreis-${slug}.ics"`,
    },
  });
};
