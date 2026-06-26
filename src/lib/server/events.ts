/* eslint-disable no-console */
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { EventDTO } from '../types';
import { db } from './db';
import type { Event, NewEvent } from './db/schema';
import { events, registrations } from './db/schema';
import { config, listmonkApiConfigured } from './config';
import { escapeHtml, formatDateLongDE, formatDateShortDE, fullAddress, timeRangeText, toDate } from './format';
import { createList, eventListName, renameList, sendNewsletterCampaign } from './listmonk';

export const countActiveRegistrations = async (eventId: string): Promise<number> => {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(registrations)
    .where(
      and(
        eq(registrations.eventId, eventId),
        isNull(registrations.deleted),
        sql`${registrations.status} in ('registered','attended')`,
      ),
    );
  return rows[0]?.c ?? 0;
};

export const isEventPast = (ev: Pick<Event, 'eventDate'>): boolean => {
  const d = toDate(ev.eventDate);
  if (!d) return false;
  const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
  return endOfDay.getTime() < Date.now();
};

export const eventDto = async (ev: Event): Promise<EventDTO> => {
  const activeCount = await countActiveRegistrations(ev.id);
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

export const getPublishedEventBySlug = async (slug: string): Promise<Event | null> => {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.isPublished, true), isNull(events.deleted)))
    .limit(1);
  return rows[0] ?? null;
};

export const getEventById = async (id: string): Promise<Event | null> => {
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ?? null;
};

const tryEventDto = async (fetch: () => Promise<Event | null>, label: string): Promise<EventDTO | null> => {
  try {
    const ev = await fetch();
    return ev ? await eventDto(ev) : null;
  } catch (err) {
    console.error(`[events] ${label} failed`, String(err));
    return null;
  }
};

export const fetchNextEvent = (): Promise<EventDTO | null> => tryEventDto(getNextEvent, 'fetchNextEvent');

export const getEventBySlug = (slug: string): Promise<EventDTO | null> =>
  tryEventDto(() => getPublishedEventBySlug(slug), 'getEventBySlug');

export const generateSlug = async (eventDate: string, excludeId?: string): Promise<string> => {
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
  const rows = await db.select().from(events).where(isNull(events.deleted)).orderBy(desc(events.eventDate));
  return Promise.all(rows.map(async (ev) => ({ ...ev, activeCount: await countActiveRegistrations(ev.id) })));
};

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
