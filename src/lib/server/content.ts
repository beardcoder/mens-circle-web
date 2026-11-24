/* eslint-disable no-console */
/**
 * What the public pages read from EmDash: published events with their free seats and
 * the published voices. A failed read is `unavailable`, never "no date planned".
 */
import { getEmDashCollection, getEmDashEntry } from 'emdash';

import type { TestimonialDTO } from '../shared/dto';
import { eventFromEntry, type EventRecord, holdsASeat } from '../shared/event-entry';
import { addDays, todayBerlin } from '../shared/time';

type Entry = { id: string; data: Record<string, unknown> };

/** Seats taken per event id, from the published registrations of those events. */
const seatsTaken = async (eventIds: string[]): Promise<Map<string, number>> => {
  const taken = new Map<string, number>();

  if (eventIds.length === 0) return taken;

  const { entries, error } = await getEmDashCollection('registrations', {
    where: { event: eventIds },
    limit: 1000,
  });

  if (error) throw error;

  for (const { data } of entries as Entry[]) {
    if (holdsASeat(data)) taken.set(String(data.event), (taken.get(String(data.event)) ?? 0) + 1);
  }

  return taken;
};

const toRecords = async (entries: Entry[]): Promise<EventRecord[]> => {
  const ids = entries.map((entry) => String(entry.data.id));
  const taken = await seatsTaken(ids);

  return entries.map((entry) =>
    eventFromEntry(
      String(entry.data.id),
      String(entry.data.slug ?? entry.id),
      entry.data,
      taken.get(String(entry.data.id)) ?? 0,
    ),
  );
};

/** Every upcoming published event, soonest first; `unavailable` when they cannot be read. */
export const fetchUpcomingEventsState = async (
  limit = 12,
): Promise<{ status: 'scheduled' | 'none' | 'unavailable'; events: EventRecord[] }> => {
  try {
    const { entries, error } = await getEmDashCollection('events', {
      // A day early (Berlin runs ahead of UTC); `is_past` then keeps today's evenings until the day is over.
      where: { starts_at: { gte: `${addDays(todayBerlin(), -1)}T00:00:00.000Z` } },
      orderBy: { starts_at: 'asc' },
      limit: limit + 2,
    });

    if (error) throw error;

    const events = (await toRecords(entries as Entry[])).filter((event) => !event.is_past).slice(0, limit);

    return { status: events.length > 0 ? 'scheduled' : 'none', events };
  } catch (err) {
    console.error('[content] upcoming events failed', String(err));

    return { status: 'unavailable', events: [] };
  }
};

/** One published event by slug. */
export const fetchEventState = async (
  slug: string,
): Promise<{ status: 'ok' | 'not-found' | 'unavailable'; event: EventRecord | null }> => {
  try {
    const { entry, error } = await getEmDashEntry('events', slug);

    if (error) throw error;

    if (!entry || entry.data.status !== 'published') return { status: 'not-found', event: null };

    const [event] = await toRecords([entry as Entry]);

    return { status: 'ok', event };
  } catch (err) {
    console.error('[content] event failed', String(err));

    return { status: 'unavailable', event: null };
  }
};

/** Published voices, newest first, and whether they could be read at all. */
export const fetchTestimonialsState = async (
  limit = 200,
): Promise<{ status: 'ok' | 'unavailable'; testimonials: TestimonialDTO[] }> => {
  try {
    const { entries, error } = await getEmDashCollection('testimonials', {
      orderBy: { published_at: 'desc' },
      limit,
    });

    if (error) throw error;

    return {
      status: 'ok',
      testimonials: (entries as Entry[]).map(({ data }) => ({
        quote: String(data.quote ?? ''),
        author: String(data.name ?? '').trim() || null,
        role: String(data.role ?? '').trim() || null,
      })),
    };
  } catch (err) {
    console.error('[content] testimonials failed', String(err));

    return { status: 'unavailable', testimonials: [] };
  }
};
