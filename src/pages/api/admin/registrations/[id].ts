import type { APIRoute } from 'astro';
import { changeRegistrationStatus, type RegStatus, softDeleteRegistration } from '@lib/server/registrations';

export const prerender = false;

const VALID: RegStatus[] = ['registered', 'waitlist', 'cancelled', 'attended'];

// PATCH /api/admin/registrations/{id} — change status. Body: { status }.
export const PATCH: APIRoute = async ({ request, params }) => {
  const id = params.id;
  if (!id) return Response.json({ success: false, message: 'Unbekannte Anmeldung.' }, { status: 404 });
  try {
    const { status } = (await request.json()) as { status?: string };
    if (!status || !VALID.includes(status as RegStatus)) {
      return Response.json({ success: false, message: 'Ungültiger Status.' }, { status: 422 });
    }
    const updated = await changeRegistrationStatus(id, status as RegStatus);
    if (!updated) return Response.json({ success: false, message: 'Anmeldung nicht gefunden.' }, { status: 404 });
    return Response.json({ success: true, message: 'Status aktualisiert.' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] change registration status failed', String(err));
    return Response.json({ success: false, message: 'Status konnte nicht geändert werden.' }, { status: 500 });
  }
};

// DELETE /api/admin/registrations/{id} — soft-delete (frees the slot).
export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) return Response.json({ success: false, message: 'Unbekannte Anmeldung.' }, { status: 404 });
  await softDeleteRegistration(id);
  return Response.json({ success: true, message: 'Anmeldung entfernt.' });
};
