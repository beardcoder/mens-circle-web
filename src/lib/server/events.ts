/* eslint-disable no-console */
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { EventDTO } from '../types';
import { db } from './db';
import type { Event, NewEvent } from './db/schema';
import { ACTIVE_REGISTRATION_STATUSES, events, registrations } from './db/schema';
import { config, listmonkApiConfigured } from './config';
import { escapeHtml, formatDateLongDE, formatDateShortDE, fullAddress, timeRangeText, toDate } from './format';
import { createList, eventListName, renameList, sendNewsletterCampaign } from './listmonk';

/**
 * The single predicate behind every capacity number: live and seat-holding.
 * Exported so registrations.ts's transactional seat claim recounts against
 * this exact definition rather than a second copy that could drift from it.
 */
export const holdsASeat = () =>
  and(isNull(registrations.deleted), inArray(registrations.status, ACTIVE_REGISTRATION_STATUSES));

export const countActiveRegistrations = async (eventId: string): Promise<number> => {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), holdsASeat()));
  return rows[0]?.c ?? 0;
};

export const isEventPast = (ev: Pick<Event, 'eventDate'>): boolean => {
  const d = toDate(ev.eventDate);
  if (!d) return false;
  const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
  return endOfDay.getTime() < Date.now();
};

const eventDtoWithCount = (ev: Event, activeCount: number): EventDTO => {
  const available = Math.max(0, ev.maxParticipants - activeCount);
  return {
    id: ev.id,
    title: ev.title,
    slug: ev.slug,
    description: ev.description,
    event_date: ev.eventDate,
    start_time: ev.startTime,
    end_time: ev.endTime,
    location: ev.location,
    location_details: ev.locationDetails,
    street: ev.street,
    postal_code: ev.postalCode,
    city: ev.city,
    latitude: ev.latitude,
    longitude: ev.longitude,
    max_participants: ev.maxParticipants,
    cost_basis: ev.costBasis,
    image_url: ev.imageUrl ?? null,
    available_spots: available,
    is_full: available <= 0,
    is_past: isEventPast(ev),
  };
};

export const eventDto = async (ev: Event): Promise<EventDTO> =>
  eventDtoWithCount(ev, await countActiveRegistrations(ev.id));

interface EventWithCapacity {
  event: Event;
  activeCount: number;
}

// Nest the predicate so Drizzle's single-table projection keeps the column
// qualifiers, and so the DTO reads one snapshot.
const eventWithCapacityQuery = () =>
  db
    .select({
      event: events,
      activeCount: sql<number>`(select count(*) from ${registrations}
        where ${and(eq(registrations.eventId, events.id), holdsASeat())})`,
    })
    .from(events);

const startOfTodayIso = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
};

export const getNextEvent = async (): Promise<Event | null> => {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.isPublished, true), isNull(events.deleted), gte(events.eventDate, startOfTodayIso())))
    .orderBy(asc(events.eventDate))
    .limit(1);
  return rows[0] ?? null;
};

const getNextEventWithCapacity = async (): Promise<EventWithCapacity | null> => {
  const rows = await eventWithCapacityQuery()
    .where(and(eq(events.isPublished, true), isNull(events.deleted), gte(events.eventDate, startOfTodayIso())))
    .orderBy(asc(events.eventDate))
    .limit(1);
  return rows[0] ?? null;
};

export const getPublishedEventBySlug = async (slug: string): Promise<Event | null> => {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.isPublished, true), isNull(events.deleted)))
    .limit(1);
  return rows[0] ?? null;
};

/** One row per publicly reachable /event/<slug> page, for the XML sitemap. */
export interface SitemapEvent {
  slug: string;
  /** ISO timestamp of the last edit — becomes `<lastmod>`. */
  updatedAt: string;
  eventDate: string;
}

/**
 * Every event that resolves to a public page, newest first. Past events are
 * included: their pages answer 200 with a real "Rückblick" state, and only the
 * next one is linked, so the sitemap is the only way to discover them. The
 * filter mirrors getPublishedEventBySlug exactly.
 */
export const listPublishedEventsForSitemap = async (): Promise<SitemapEvent[]> =>
  db
    .select({ slug: events.slug, updatedAt: events.updatedAt, eventDate: events.eventDate })
    .from(events)
    .where(and(eq(events.isPublished, true), isNull(events.deleted)))
    .orderBy(desc(events.eventDate));

export const getEventById = async (id: string): Promise<Event | null> => {
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ?? null;
};

const tryEventDto = async (fetch: () => Promise<EventWithCapacity | null>, label: string): Promise<EventDTO | null> => {
  try {
    const row = await fetch();
    return row ? eventDtoWithCount(row.event, row.activeCount) : null;
  } catch (err) {
    console.error(`[events] ${label} failed`, String(err));
    return null;
  }
};

export const fetchNextEvent = (): Promise<EventDTO | null> => tryEventDto(getNextEventWithCapacity, 'fetchNextEvent');

/**
 * The scheduling state as three cases. `fetchNextEvent` collapses "nothing
 * scheduled" and "the read failed" into one `null`; anything that puts the
 * answer in front of a reader must tell them apart and uses this instead.
 */
export type NextEventState =
  { status: 'scheduled'; event: EventDTO } | { status: 'none'; event: null } | { status: 'unavailable'; event: null };

export const fetchNextEventState = async (): Promise<NextEventState> => {
  try {
    const row = await getNextEventWithCapacity();

    return row
      ? { status: 'scheduled', event: eventDtoWithCount(row.event, row.activeCount) }
      : { status: 'none', event: null };
  } catch (err) {
    console.error('[events] fetchNextEventState failed', String(err));

    return { status: 'unavailable', event: null };
  }
};

export const getEventBySlug = (slug: string): Promise<EventDTO | null> =>
  tryEventDto(async () => {
    const rows = await eventWithCapacityQuery()
      .where(and(eq(events.slug, slug), eq(events.isPublished, true), isNull(events.deleted)))
      .limit(1);
    return rows[0] ?? null;
  }, 'getEventBySlug');

const generateSlug = async (eventDate: string, excludeId?: string): Promise<string> => {
  const base = String(eventDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) {
    return `event-${Date.now().toString(36)}`;
  }
  let candidate = base;
  let n = 2;
  for (;;) {
    const rows = await db.select({ id: events.id }).from(events).where(eq(events.slug, candidate)).limit(1);
    const hit = rows[0];
    if (!hit || (excludeId && hit.id === excludeId)) break;
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
};

export const ensureEventList = async (ev: Event): Promise<number> => {
  if (!listmonkApiConfigured()) return 0;
  if (ev.listmonkListId && ev.listmonkListId > 0) return ev.listmonkListId;
  const id = await createList(eventListName(ev.title, formatDateShortDE(ev.eventDate)));
  if (!id) return 0;
  try {
    await db.update(events).set({ listmonkListId: id }).where(eq(events.id, ev.id));
    ev.listmonkListId = id;
  } catch (err) {
    console.error('[events] failed to persist listmonk_list_id', ev.id, String(err));
  }
  return id;
};

export const DEFAULT_EVENT_NEWSLETTER_INTRO = `es ist wieder so weit – der nächste Männerkreis steht an. Ein Abend, an dem wir gemeinsam zur Ruhe kommen, offen sprechen und einander auf Augenhöhe begegnen.

Der Männerkreis ist ein geschützter Raum, in dem du dich zeigen kannst, wie du wirklich bist – ohne Rollen, ohne Bewertung. Es geht um echte Begegnung, gegenseitige Unterstützung und darum, gemeinsam zu wachsen.

Die Teilnehmerzahl ist bewusst klein gehalten. Wenn du dabei sein möchtest, sichere dir deinen Platz – ich freue mich auf dich.`;

const introToProse = (text: string): string =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\r?\n/g, '<br />')}</p>`)
    .join('\n');

const buildEventNewsletterHtml = (ev: Event, intro: string): string => {
  const url = `${config.APP_URL}/event/${ev.slug}`;
  const dateLong = formatDateLongDE(ev.eventDate);
  const time = timeRangeText(ev);
  const address = fullAddress(ev) || ev.location || '';

  const facts: string[] = [];
  if (dateLong) facts.push(`<strong>Wann:</strong> ${escapeHtml(dateLong)}${time ? `, ${escapeHtml(time)}` : ''}`);
  if (address) facts.push(`<strong>Wo:</strong> ${escapeHtml(address)}`);
  if (ev.costBasis) facts.push(`<strong>Beitrag:</strong> ${escapeHtml(ev.costBasis)}`);

  const body = intro.trim() ? intro : DEFAULT_EVENT_NEWSLETTER_INTRO;

  return [
    introToProse(body),
    `<h2>${escapeHtml(ev.title)}</h2>`,
    facts.length ? `<p>${facts.join('<br />')}</p>` : '',
    `<p><a href="${escapeHtml(url)}"><strong>Zum Termin &amp; zur Anmeldung →</strong></a></p>`,
  ]
    .filter(Boolean)
    .join('\n');
};

export const sendEventNewsletter = async (
  eventId: string,
  subject: string,
  intro: string,
): Promise<{ ok: boolean; campaignId: number; error?: string }> => {
  const ev = await getEventById(eventId);
  if (!ev) return { ok: false, campaignId: 0, error: 'Veranstaltung nicht gefunden.' };

  const dateShort = formatDateShortDE(ev.eventDate);
  return sendNewsletterCampaign({
    name: `Event-Newsletter: ${ev.title}${dateShort ? ` (${dateShort})` : ''}`,
    subject: subject.trim(),
    bodyHtml: buildEventNewsletterHtml(ev, intro),
    listIds: config.LISTMONK_LIST_IDS,
    templateId: config.CAMPAIGN_TEMPLATE_ID,
  });
};

export interface EventInput {
  title: string;
  slug?: string;
  description?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  locationDetails?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  maxParticipants?: number;
  costBasis?: string;
  isPublished?: boolean;
  imageUrl?: string | null;
}

export const listEventsForAdmin = async (): Promise<Array<Event & { activeCount: number }>> => {
  // One grouped LEFT JOIN instead of a COUNT per event. `count(<column>)`, not
  // `count(*)`: it counts matched rows only, so an event with no registrations
  // yields 0 rather than 1.
  const rows = await db
    .select({
      event: events,
      activeCount: sql<number>`count(${registrations.id})`,
    })
    .from(events)
    .leftJoin(registrations, and(eq(registrations.eventId, events.id), holdsASeat()))
    .where(isNull(events.deleted))
    .groupBy(events.id)
    .orderBy(desc(events.eventDate));

  return rows.map(({ event, activeCount }) => ({ ...event, activeCount }));
};

// A lookup table, not branching: the cyclomatic count reads every `??` as a
// decision and lands on 15.
// eslint-disable-next-line complexity
const inputToColumns = (input: EventInput): Partial<NewEvent> => ({
  title: input.title.trim(),
  description: input.description ?? '',
  eventDate: input.eventDate,
  startTime: input.startTime ?? '',
  endTime: input.endTime ?? '',
  location: input.location ?? '',
  locationDetails: input.locationDetails ?? '',
  street: input.street ?? '',
  postalCode: input.postalCode ?? '',
  city: input.city ?? '',
  latitude: input.latitude ?? null,
  longitude: input.longitude ?? null,
  maxParticipants: input.maxParticipants ?? 8,
  costBasis: input.costBasis ?? '',
  isPublished: input.isPublished ?? false,
  imageUrl: input.imageUrl ?? null,
});

export const createEvent = async (input: EventInput): Promise<Event> => {
  const slug = input.slug?.trim() || (await generateSlug(input.eventDate));
  const rows = await db
    .insert(events)
    .values({ ...(inputToColumns(input) as NewEvent), slug })
    .returning();
  const created = rows[0];
  void ensureEventList(created).catch(() => {});
  return created;
};

export const updateEvent = async (id: string, input: EventInput): Promise<Event | null> => {
  const existing = await getEventById(id);
  if (!existing) return null;
  const slug = input.slug?.trim() || existing.slug || (await generateSlug(input.eventDate, id));
  const rows = await db
    .update(events)
    .set({ ...inputToColumns(input), slug })
    .where(eq(events.id, id))
    .returning();
  const updated = rows[0] ?? null;

  if (updated && updated.listmonkListId > 0) {
    const titleChanged = existing.title !== updated.title;
    const dateChanged = existing.eventDate !== updated.eventDate;
    if (titleChanged || dateChanged) {
      void renameList(updated.listmonkListId, eventListName(updated.title, formatDateShortDE(updated.eventDate))).catch(
        () => {},
      );
    }
  }
  return updated;
};

export const softDeleteEvent = async (id: string): Promise<void> => {
  await db
    .update(events)
    .set({ deleted: new Date().toISOString(), isPublished: false })
    .where(and(eq(events.id, id), isNull(events.deleted)));
};
