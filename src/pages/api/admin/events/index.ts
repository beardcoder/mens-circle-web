import type { APIRoute } from 'astro';
import { createEvent, type EventInput } from '@lib/server/events';

export const prerender = false;

/** Coerce the admin form body into an EventInput. */
export function parseEventBody(raw: Record<string, unknown>): EventInput {
  const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const numOrNull = (v: unknown) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // event_date arrives as "YYYY-MM-DD" from the date input → store as ISO UTC.
  let eventDate = str(raw.eventDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) eventDate = `${eventDate}T00:00:00.000Z`;

  return {
    title: str(raw.title).trim(),
    slug: str(raw.slug).trim() || undefined,
    description: str(raw.description),
    eventDate,
    startTime: str(raw.startTime).trim(),
    endTime: str(raw.endTime).trim(),
    location: str(raw.location).trim(),
    locationDetails: str(raw.locationDetails),
    street: str(raw.street).trim(),
    postalCode: str(raw.postalCode).trim(),
    city: str(raw.city).trim(),
    latitude: numOrNull(raw.latitude),
    longitude: numOrNull(raw.longitude),
    maxParticipants: Number(raw.maxParticipants) || 8,
    costBasis: str(raw.costBasis).trim(),
    isPublished: raw.isPublished === true || raw.isPublished === 'true',
    imageUrl: str(raw.imageUrl).trim() || null,
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = parseEventBody(body);
    if (!input.title) {
      return Response.json({ success: false, message: 'Titel ist erforderlich.' }, { status: 422 });
    }
    if (!input.eventDate) {
      return Response.json({ success: false, message: 'Datum ist erforderlich.' }, { status: 422 });
    }
    const event = await createEvent(input);
    return Response.json({ success: true, message: 'Veranstaltung erstellt.', id: event.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] create event failed', String(err));
    return Response.json({ success: false, message: 'Veranstaltung konnte nicht erstellt werden.' }, { status: 500 });
  }
};
