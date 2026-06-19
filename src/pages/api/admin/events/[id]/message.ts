import type { APIRoute } from 'astro';
import { broadcastEventMessage } from '@lib/server/registrations';

export const prerender = false;

// POST /api/admin/events/{id}/message — send a message to all registered
// participants of the event via listmonk's transactional API.
export const POST: APIRoute = async ({ request, params }) => {
  const id = params.id;
  if (!id) return Response.json({ success: false, message: 'Unbekannte Veranstaltung.' }, { status: 404 });
  try {
    const { subject, content } = (await request.json()) as { subject?: string; content?: string };
    if (!subject?.trim() || !content?.trim()) {
      return Response.json({ success: false, message: 'Betreff und Nachricht sind erforderlich.' }, { status: 422 });
    }
    const { sent, total } = await broadcastEventMessage(id, subject.trim(), content);
    return Response.json({
      success: true,
      message: `Nachricht an ${sent} von ${total} Teilnehmer:innen gesendet.`,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] broadcast message failed', String(err));
    return Response.json({ success: false, message: 'Nachricht konnte nicht gesendet werden.' }, { status: 500 });
  }
};
