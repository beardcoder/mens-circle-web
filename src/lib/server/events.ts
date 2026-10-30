/* eslint-disable no-console */
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';

import type { EventInput } from '../event-input';
import type { EventDTO } from '../types';
import { config, listmonkApiConfigured } from './config';
import { db } from './db';
import type { Event } from './db/schema';
import { ACTIVE_REGISTRATION_STATUSES, events, registrations } from './db/schema';
import { escapeHtml, formatDateLongDE, formatDateShortDE, fullAddress, timeRangeText, toDate } from './format';
import { createList, renameList, sendNewsletterCampaign } from './listmonk';

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

/** Published and not deleted: what the public may see. */
const isPublic = () => and(eq(events.isPublished, true), isNull(events.deleted));

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

/** Upcoming public events with their seat counts, soonest first. */
const upcomingQuery = (limit: number) =>
  eventWithCapacityQuery()
    .where(and(isPublic(), gte(events.eventDate, startOfTodayIso())))
    .orderBy(asc(events.eventDate))
    .limit(limit);

export const getPublishedEventBySlug = async (slug: string): Promise<Event | null> => {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), isPublic()))
    .limit(1);

  return rows[0] ?? null;
};

/** Every public event page, past ones included (the sitemap is their only link). */
export const listPublishedEventsForSitemap = (): Promise<Array<{ slug: string; updatedAt: string }>> =>
  db
    .select({ slug: events.slug, updatedAt: events.updatedAt })
    .from(events)
    .where(isPublic())
    .orderBy(desc(events.eventDate));

export const getEventById = async (id: string): Promise<Event | null> => {
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);

  return rows[0] ?? null;
};

/** `unavailable` (read failed) must never be shown as "no date planned". */
type NextEventState =
  { status: 'scheduled'; event: EventDTO } | { status: 'none'; event: null } | { status: 'unavailable'; event: null };

/** Every upcoming published event, soonest first, for the overview; `unavailable` when they cannot be read. */
export const fetchUpcomingEventsState = async (
  limit = 12,
): Promise<{ status: NextEventState['status']; events: EventDTO[] }> => {
  try {
    const rows = await upcomingQuery(limit);
    const list = rows.map((row) => eventDtoWithCount(row.event, row.activeCount));

    return { status: list.length > 0 ? 'scheduled' : 'none', events: list };
  } catch (err) {
    console.error('[events] fetchUpcomingEventsState failed', String(err));

    return { status: 'unavailable', events: [] };
  }
};

export const fetchEventState = async (
  slug: string,
): Promise<{
  status: 'ok' | 'not-found' | 'unavailable';
  event: EventDTO | null;
}> => {
  try {
    const [row] = await eventWithCapacityQuery()
      .where(and(eq(events.slug, slug), isPublic()))
      .limit(1);

    return row
      ? { status: 'ok', event: eventDtoWithCount(row.event, row.activeCount) }
      : { status: 'not-found', event: null };
  } catch (err) {
    console.error('[events] getEventBySlug failed', String(err));

    return { status: 'unavailable', event: null };
  }
};

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

/** "Event: Männerkreis (16.10.2026)": the per-event listmonk list. */
const eventListName = (title: string, dateShort: string): string => {
  const t = (title || 'Veranstaltung').trim();

  return dateShort ? `Event: ${t} (${dateShort})` : `Event: ${t}`;
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

// The campaign template's palette and type; inline, so the block holds in any template.
const NL = {
  text: '#1b241e',
  muted: '#5a6255',
  lineStrong: '#c8bfac',
  sand: '#ece4d4',
  fill: '#b4532a',
  onFill: '#fff8f0',
  serif: "'Fraunces',Georgia,'Times New Roman',serif",
  sans: "'Figtree','Helvetica Neue',Helvetica,Arial,sans-serif",
};

const newsletterRow = ([label, value]: [string, string]): string =>
  `<tr><td width="88" style="width:88px;padding:4px 12px 4px 0;vertical-align:top;font-family:${NL.sans};font-size:14px;line-height:24px;color:${NL.muted};">${label}</td>` +
  `<td style="padding:4px 0;vertical-align:top;font-family:${NL.sans};font-size:16px;line-height:24px;color:${NL.text};">${escapeHtml(value)}</td></tr>`;

/**
 * The event as the site's date summary sets it: a rounded sand card with the
 * label, the date, the title, the facts as rows and the one round action.
 */
const buildEventNewsletterHtml = (ev: Event, intro: string): string => {
  const url = `${config.APP_URL}/event/${ev.slug}`;
  const dateLong = formatDateLongDE(ev.eventDate);
  const body = intro.trim() ? intro : DEFAULT_EVENT_NEWSLETTER_INTRO;

  const rows = (
    [
      ['Zeit', timeRangeText(ev)],
      ['Ort', ev.location],
      ['Adresse', fullAddress(ev)],
      ['Beitrag', ev.costBasis],
    ] satisfies [string, string][]
  ).filter(([, value]) => value);

  const event = [
    `<div class="em-event" style="margin:10px 0 30px;padding:26px 28px 24px;background-color:${NL.sand};border-radius:20px;">`,
    `<p style="margin:0 0 10px;font-family:${NL.sans};font-size:14px;font-weight:600;line-height:1.3;color:${NL.muted};">Nächster Termin</p>`,
    dateLong
      ? `<p class="em-event__date" style="margin:0;font-family:${NL.serif};font-size:26px;font-weight:500;line-height:1.25;color:${NL.text};">${escapeHtml(dateLong)}</p>`
      : '',
    `<h2 style="margin:4px 0 0;font-family:${NL.sans};font-size:16px;font-weight:600;line-height:1.5;letter-spacing:0;color:${NL.text};">${escapeHtml(ev.title)}</h2>`,
    rows.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid ${NL.lineStrong};"><tr><td style="padding-top:12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map(newsletterRow).join('')}</table></td></tr></table>`
      : '',
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr><td style="background-color:${NL.fill};border-radius:999px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 26px;font-family:${NL.sans};font-size:16px;font-weight:600;line-height:1.1;color:${NL.onFill};text-decoration:none;border-radius:999px;">Zur Anmeldung&nbsp;&nbsp;&rarr;</a></td></tr></table>`,
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

export const createEvent = async (input: EventInput): Promise<Event> => {
  const slug = input.slug || (await generateSlug(input.eventDate));

  const rows = await db
    .insert(events)
    .values({ ...input, slug })
    .returning();

  const created = rows[0];

  void ensureEventList(created).catch(() => {});

  return created;
};

export const updateEvent = async (id: string, input: EventInput): Promise<Event | null> => {
  const existing = await getEventById(id);

  if (!existing) return null;

  const slug = input.slug || existing.slug || (await generateSlug(input.eventDate, id));

  const rows = await db
    .update(events)
    .set({ ...input, slug })
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

export const setEventPublished = async (id: string, isPublished: boolean): Promise<boolean> => {
  const rows = await db
    .update(events)
    .set({ isPublished })
    .where(and(eq(events.id, id), isNull(events.deleted)))
    .returning({ id: events.id });

  return rows.length > 0;
};

export const softDeleteEvent = async (id: string): Promise<void> => {
  await db
    .update(events)
    .set({ deleted: new Date().toISOString(), isPublished: false })
    .where(and(eq(events.id, id), isNull(events.deleted)));
};
