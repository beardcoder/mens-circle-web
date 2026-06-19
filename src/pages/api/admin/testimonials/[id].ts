import type { APIRoute } from 'astro';
import { setTestimonialPublished, setTestimonialSortOrder, softDeleteTestimonial } from '@lib/server/testimonials';

export const prerender = false;

// PATCH /api/admin/testimonials/{id} — { publish?: boolean, sortOrder?: number }.
export const PATCH: APIRoute = async ({ request, params }) => {
  const id = params.id;
  if (!id) return Response.json({ success: false, message: 'Unbekannt.' }, { status: 404 });
  try {
    const body = (await request.json()) as { publish?: boolean; sortOrder?: number };
    if (typeof body.sortOrder === 'number') {
      await setTestimonialSortOrder(id, body.sortOrder);
    }
    if (typeof body.publish === 'boolean') {
      const updated = await setTestimonialPublished(id, body.publish);
      if (!updated) return Response.json({ success: false, message: 'Nicht gefunden.' }, { status: 404 });
    }
    return Response.json({ success: true, message: 'Gespeichert.' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api] testimonial patch failed', String(err));
    return Response.json({ success: false, message: 'Konnte nicht gespeichert werden.' }, { status: 500 });
  }
};

// DELETE /api/admin/testimonials/{id} — soft-delete.
export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) return Response.json({ success: false, message: 'Unbekannt.' }, { status: 404 });
  await softDeleteTestimonial(id);
  return Response.json({ success: true, message: 'Gelöscht.' });
};
