import type { AdminEvent, EventsData, OverviewData, RegistrationsData, Testimonial } from '../shared/admin-types';
import { todayBerlin } from '../shared/time';
import { getEventById, listEventsForAdmin } from './events';
import { listRegistrationsForEvent } from './registrations';
import { countPendingTestimonials, listTestimonialsForAdmin } from './testimonials';

const toAdminEvent = ({
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
}: Awaited<ReturnType<typeof listEventsForAdmin>>[number]): AdminEvent => ({
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
});

/** The events list (/admin/events): events with their seat counts, nothing else. */
export async function readAdminEvents(): Promise<EventsData> {
  return { events: (await listEventsForAdmin()).map(toAdminEvent) };
}

/** The overview: events, the next event's people and the voices waiting. Called only behind the page middleware or requireAdmin; never cached. */
export async function readAdminOverview(): Promise<OverviewData> {
  const [rows, pendingTestimonials] = await Promise.all([listEventsForAdmin(), countPendingTestimonials()]);
  const today = todayBerlin();

  const next = rows
    .filter((event) => event.eventDate.slice(0, 10) >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];

  return {
    events: rows.map(toAdminEvent),
    nextEventId: next?.id ?? null,
    people: next ? await listRegistrationsForEvent(next.id) : [],
    pendingTestimonials,
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
