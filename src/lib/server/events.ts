/* eslint-disable no-console */
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { EventDTO } from '../types';
import { db } from './db';
import type { Event, NewEvent } from './db/schema';
import { ACTIVE_REGISTRATION_STATUSES, events, registrations } from './db/schema';
import { config, listmonkApiConfigured } from './config';
import { escapeHtml, formatDateLongDE, formatDateShortDE, fullAddress, timeRangeText, toDate } from './format';
import { createList, eventListName, renameList, sendNewsletterCampaign } from './listmonk';

/** The one definition of a seat-holding registration; reused by the seat claim. */
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

interface EventWithCapacity {
  event: Event;
  activeCount: number;
}

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
  updatedAt: string;
  eventDate: string;
}

/** Every public event page, past ones included (the sitemap is their only link). */
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

/** `unavailable` (read failed) must never be shown as "no date planned". */
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

// Opens after the campaign template's "Hallo,": hence the lower case.
export const DEFAULT_EVENT_NEWSLETTER_INTRO = `der nächste Männerkreis steht fest. Ein Abend, an dem wir im Kreis sitzen, einander zuhören und über das sprechen, was gerade wirklich da ist\u00a0– ohne Bewertung und ohne Ratschläge.

Vorbereiten musst du nichts, und darstellen auch nicht. Je nach Abend kommen einfache Übungen mit Atem und Körperwahrnehmung dazu; du machst mit, soweit es für dich passt.

Die Runde bleibt bewusst klein. Wenn du dabei sein möchtest, melde dich auf der Seite des Termins an\u00a0– ich freue mich auf dich.`;

const introToProse = (text: string): string =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\r?\n/g, '<br />')}</p>`)
    .join('\n');

// The campaign template's palette; inline, so the block holds in any template.
const NL = { night: '#151210', chalk: '#f1e9db', muted: '#b3a594', flame: '#e4632e' };

/** The event as the site sets it: the date in flame capitals on the night ground, then the facts as one line. */
const buildEventNewsletterHtml = (ev: Event, intro: string): string => {
  const url = `${config.APP_URL}/event/${ev.slug}`;
  const dateLong = formatDateLongDE(ev.eventDate);
  const where = [timeRangeText(ev), fullAddress(ev) || ev.location || ''].filter(Boolean).join(' · ');
  const body = intro.trim() ? intro : DEFAULT_EVENT_NEWSLETTER_INTRO;

  const event = [
    `<div class="em-event" style="margin:8px 0 26px;padding:24px 26px;background-color:${NL.night};border-radius:3px;">`,
    dateLong
      ? `<p class="em-event__date" style="margin:0 0 8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${NL.flame};">${escapeHtml(dateLong)}</p>`
      : '',
    `<h2 style="margin:0 0 10px;color:${NL.chalk};">${escapeHtml(ev.title)}</h2>`,
    where ? `<p style="margin:0 0 6px;color:${NL.chalk};">${escapeHtml(where)}</p>` : '',
    ev.costBasis ? `<p style="margin:0 0 6px;color:${NL.muted};">Beitrag: ${escapeHtml(ev.costBasis)}</p>` : '',
    `<p style="margin:14px 0 0;"><a href="${escapeHtml(url)}" style="color:${NL.chalk};font-weight:600;text-decoration:underline;text-decoration-color:${NL.flame};">Zur Anmeldung&nbsp;→</a></p>`,
    '</div>',
  ]
    .filter(Boolean)
    .join('\n');

  return [introToProse(body), event].join('\n');
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
  // count(column), not count(*): an event without registrations counts 0.
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

// A lookup table; every `??` counts as a branch.
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
