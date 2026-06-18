/** POST /api/admin/testimonials/action — publish / unpublish / delete. */
import type { APIRoute } from 'astro';
import { getServices } from '../../../../server/container';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  const action = String(form.get('action') ?? '');

  if (id) {
    try {
      const { testimonials } = getServices();
      if (action === 'publish') await testimonials.setPublished(id, true);
      else if (action === 'unpublish')
        await testimonials.setPublished(id, false);
      else if (action === 'delete') await testimonials.remove(id);
    } catch (err) {
      console.error('/api/admin/testimonials/action failed', String(err));
    }
  }
  return redirect('/admin/testimonials', 303);
};
