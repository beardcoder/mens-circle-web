/** POST /api/admin/events/save — create or update an event (multipart for image). */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { config } from '../../../../server/config';
import { getServices } from '../../../../server/container';
import type { EventInput } from '../../../../server/services/events';

export const prerender = false;

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function num(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** datetime-local "YYYY-MM-DDTHH:MM" → Date, interpreting the wall clock as UTC
 *  so it round-trips with the UTC-based rendering used everywhere else. */
function parseEventDate(value: string): Date | null {
  if (!value) return null;
  const iso = value.length === 16 ? `${value}:00Z` : `${value}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function saveImage(eventId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-100) || 'image';
  const dir = path.join(config.UPLOAD_DIR, eventId);
  mkdirSync(dir, { recursive: true });
  await Bun.write(path.join(dir, safe), file);
  return safe;
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const { events } = getServices();
  const form = await request.formData();
  const id = str(form, 'id');

  const eventDate = parseEventDate(str(form, 'event_date'));
  if (!str(form, 'title') || !eventDate) {
    return redirect(
      id ? `/admin/events/${id}?error=1` : '/admin/events/new?error=1',
      303,
    );
  }

  const input: EventInput = {
    title: str(form, 'title'),
    slug: str(form, 'slug') || undefined,
    description: str(form, 'description') || null,
    eventDate,
    startTime: str(form, 'start_time') || null,
    endTime: str(form, 'end_time') || null,
    location: str(form, 'location') || null,
    locationDetails: str(form, 'location_details') || null,
    street: str(form, 'street') || null,
    postalCode: str(form, 'postal_code') || null,
    city: str(form, 'city') || null,
    latitude: num(form, 'latitude'),
    longitude: num(form, 'longitude'),
    maxParticipants: num(form, 'max_participants') ?? 8,
    costBasis: str(form, 'cost_basis') || null,
    isPublished: form.get('is_published') != null,
  };

  const image = form.get('image');
  const hasNewImage = image instanceof File && image.size > 0;

  try {
    let eventId = id;
    if (id) {
      await events.update(id, input);
    } else {
      const created = await events.create(input);
      eventId = created.id;
    }
    if (hasNewImage && eventId) {
      const name = await saveImage(eventId, image as File);
      await events.update(eventId, { ...input, image: name });
    }
    return redirect('/admin/events?saved=1', 303);
  } catch (err) {
    console.error('/api/admin/events/save failed', String(err));
    return redirect(
      id ? `/admin/events/${id}?error=1` : '/admin/events/new?error=1',
      303,
    );
  }
};
