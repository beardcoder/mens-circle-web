import type { OverviewData, RegistrationsData, Testimonial } from '@components/admin/types';

import { getEventById, listEventsForAdmin } from './events';
import { listRegistrationsForEvent } from './registrations';
import { listTestimonialsForAdmin } from './testimonials';

/** Called only behind the page middleware or requireAdmin; never cached. */
export async function readAdminOverview(): Promise<OverviewData> {
  const [rows, voices] = await Promise.all([listEventsForAdmin(), listTestimonialsForAdmin()]);
  const today = new Date().toISOString().slice(0, 10);

  const next = rows
    .filter((event) => event.eventDate.slice(0, 10) >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];

  return {
    events: rows.map(
      ({
        id,
        title,
        slug,
        eventDate,
        startTime,
        endTime,
        location,
        city,
        maxParticipants,
        activeCount,
        isPublished,
      }) => ({
        id,
        title,
        slug,
        eventDate,
        startTime,
        endTime,
        location,
        city,
        maxParticipants,
        activeCount,
        isPublished,
      }),
    ),
    nextEventId: next?.id ?? null,
    people: next ? await listRegistrationsForEvent(next.id) : [],
    pendingTestimonials: voices.filter((voice) => !voice.isPublished).length,
  };
}

export async function readAdminRegistrations(eventId: string): Promise<RegistrationsData | null> {
  const event = await getEventById(eventId);

  if (!event || event.deleted) return null;

  return {
    eventId: event.id,
    eventTitle: event.title,
    maxParticipants: event.maxParticipants,
    registrations: await listRegistrationsForEvent(event.id),
  };
}

export async function readAdminTestimonials(): Promise<{ testimonials: Testimonial[] }> {
  const rows = await listTestimonialsForAdmin();

  return {
    testimonials: rows.map(({ id, quote, authorName, role, email, isPublished, sortOrder, createdAt }) => ({
      id,
      quote,
      authorName,
      role,
      email,
      isPublished,
      sortOrder,
      createdAt,
    })),
  };
}
