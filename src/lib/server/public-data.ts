import { createHash } from 'node:crypto';

import type { PublicEvent, PublicEvents } from '@components/event/types';
import { dateStatus, eventView, splitFee } from '@lib/event-status';
import type { EventDTO } from '@lib/types';

import { fetchEventState, fetchUpcomingEventsState } from './events';
import { fetchTestimonialsState } from './testimonials';

export class PublicDataError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const publicEvent = (event: EventDTO): PublicEvent => ({
  id: event.id,
  slug: event.slug,
  view: eventView(event, 'Nächster Termin'),
  availableSpots: event.available_spots,
  maxParticipants: event.max_participants,
  isPast: event.is_past,
});

export async function readPublicEvents(): Promise<PublicEvents> {
  const result = await fetchUpcomingEventsState();

  if (result.status === 'unavailable') throw new PublicDataError(503, 'Die Termine sind gerade nicht abrufbar.');

  return {
    fee: splitFee(result.events[0]?.cost_basis),
    status: result.status,
    events: result.events.map(publicEvent),
    next: dateStatus(result.status, result.events[0] ?? null).next,
  };
}

/** Full DTO stays on the server for the event page and JSON-LD. */
export async function readPublicEvent(slug: string): Promise<EventDTO> {
  const result = await fetchEventState(slug);

  if (result.status === 'unavailable') throw new PublicDataError(503, 'Der Termin ist gerade nicht abrufbar.');

  if (!result.event) throw new PublicDataError(404, 'Dieser Termin wurde nicht gefunden.');

  return result.event;
}

export async function readPublicTestimonials() {
  const result = await fetchTestimonialsState(200);

  if (result.status === 'unavailable') throw new PublicDataError(503, 'Die Erfahrungen sind gerade nicht abrufbar.');

  return { testimonials: result.testimonials };
}

/** Conditional HTTP reads; no cookies, identifiers or internal error details. */
export async function publicJson(request: Request, read: () => Promise<unknown>): Promise<Response> {
  try {
    const body = JSON.stringify(await read());
    const etag = `"${createHash('sha256').update(body).digest('base64url')}"`;

    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    };

    return request.headers.get('If-None-Match') === etag
      ? new Response(null, { status: 304, headers })
      : new Response(body, { headers });
  } catch (error) {
    const status = error instanceof PublicDataError ? error.status : 503;
    const message = error instanceof PublicDataError ? error.message : 'Die Daten sind gerade nicht abrufbar.';

    return Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
