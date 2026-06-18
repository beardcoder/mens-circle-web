/** POST /api/admin/events/delete — permanently delete an event (cascades). */
import type { APIRoute } from 'astro';
import { getServices } from '../../../../server/container';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  if (id) {
    try {
      await getServices().events.remove(id);
    } catch (err) {
      console.error('/api/admin/events/delete failed', String(err));
    }
  }
  return redirect('/admin/events?deleted=1', 303);
};
