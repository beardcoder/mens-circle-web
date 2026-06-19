import type { APIRoute } from 'astro';
import { softDeleteEvent, updateEvent } from '@lib/server/events';
import { parseEventBody } from './index';

export const prerender = false;

export const PUT: APIRoute = async ({ request, params }) => {
  const id = params.id;
  if (!id) return Response.json({ success: false, message: 'Unbekannte Veranstaltung.' }, { status: 404 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = parseEventBody(body);
    if (!input.title || !input.eventDate) {
      return Response.json({ success: false, message: 'Titel und Datum sind erforderlich.' }, { status: 422 });
    }
    const event = await updateEvent(id, input);
    if (!event) return Response.json({ success: false, message: 'Veranstaltung nicht gefunden.' }, { status: 404 });
    return Response.json({ success: true, message: 'Veranstaltung gespeichert.', id: event.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] update event failed', String(err));
    return Response.json(
      { success: false, message: 'Veranstaltung konnte nicht gespeichert werden.' },
      { status: 500 },
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) return Response.json({ success: false, message: 'Unbekannte Veranstaltung.' }, { status: 404 });
  await softDeleteEvent(id);
  return Response.json({ success: true, message: 'Veranstaltung gelöscht.' });
};
