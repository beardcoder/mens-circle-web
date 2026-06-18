/** POST /api/admin/registrations/status — change a registration's status. */
import type { APIRoute } from 'astro';
import { getServices } from '../../../../server/container';
import {
  REGISTRATION_STATUSES,
  type RegistrationStatus,
} from '../../../../server/db/schema';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  const status = String(form.get('status') ?? '');
  const eventId = String(form.get('event_id') ?? '');

  if (id && (REGISTRATION_STATUSES as readonly string[]).includes(status)) {
    try {
      await getServices().registrations.setStatus(
        id,
        status as RegistrationStatus,
      );
    } catch (err) {
      console.error('/api/admin/registrations/status failed', String(err));
    }
  }
  return redirect(eventId ? `/admin/events/${eventId}` : '/admin/events', 303);
};
