/**
 * Event + testimonial data access (server-only). Replaces the read paths of the
 * former `pocketbase-server.ts` and the event logic of the PocketBase hooks:
 * the public DTO, capacity/waitlist computation, slug auto-generation and the
 * per-event listmonk list bookkeeping.
 */
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { EventDTO, Testimonial as TestimonialDTO } from '../types';
import { db } from './db';
import type { Event, NewEvent } from './db/schema';
import { events, registrations, testimonials } from './db/schema';
import { config, listmonkApiConfigured } from './config';
import { escapeHtml, formatDateLongDE, formatDateShortDE, fullAddress, timeRangeText, toDate } from './format';
import { createList, eventListName, renameList, sendNewsletterCampaign } from './listmonk';

/** Count active registrations (registered|attended, not soft-deleted). */
export async function countActiveRegistrations(eventId: string): Promise<number> {
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
}

/** Is the event in the past? (end of its day has passed) */
export function isEventPast(ev: Pick<Event, 'eventDate'>): boolean {
  const d = toDate(ev.eventDate);
  if (!d) return false;
  const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
  return endOfDay.getTime() < Date.now();
}

/** Build the public DTO for an event row (computes live capacity). */
export async function eventDto(ev: Event): Promise<EventDTO> {
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
}

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
}

/** The next upcoming published event, or null. */
export async function getNextEvent(): Promise<Event | null> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.isPublished, true), isNull(events.deleted), gte(events.eventDate, startOfTodayIso())))
    .orderBy(asc(events.eventDate))
    .limit(1);
  return rows[0] ?? null;
}

/** A single published event by slug (past or upcoming), or null. */
export async function getPublishedEventBySlug(slug: string): Promise<Event | null> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.isPublished, true), isNull(events.deleted)))
    .limit(1);
  return rows[0] ?? null;
}

/** Any event by id (admin), or null. */
export async function getEventById(id: string): Promise<Event | null> {
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0] ?? null;
}

// ── Public fetchers used by the Astro pages (DTO shape) ──────────────────────

export async function fetchNextEvent(): Promise<EventDTO | null> {
  try {
    const ev = await getNextEvent();
    return ev ? await eventDto(ev) : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[events] fetchNextEvent failed', String(err));
    return null;
  }
}

export async function getEventBySlug(slug: string): Promise<EventDTO | null> {
  try {
    const ev = await getPublishedEventBySlug(slug);
    return ev ? await eventDto(ev) : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[events] getEventBySlug failed', String(err));
    return null;
  }
}

/** Published testimonials, sorted. Empty on failure. */
export async function fetchTestimonials(): Promise<TestimonialDTO[]> {
  try {
    const rows = await db
      .select()
      .from(testimonials)
      .where(and(eq(testimonials.isPublished, true), isNull(testimonials.deleted)))
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.publishedAt))
      .limit(200);
    return rows.map((r) => ({
      quote: r.quote,
      author: r.authorName || null,
      role: r.role || null,
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[events] fetchTestimonials failed', String(err));
    return [];
  }
}

// ── Slug generation ──────────────────────────────────────────────────────────

/**
 * Derive a date-based slug (e.g. "2026-06-12") from `eventDate`, with a numeric
 * suffix on same-day collisions. Mirrors the old PocketBase auto-slug hook.
 */
export async function generateSlug(eventDate: string, excludeId?: string): Promise<string> {
  const base = String(eventDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) {
    // Fall back to a random-ish slug so the unique index never blocks a save.
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
}

// ── Per-event listmonk list ──────────────────────────────────────────────────

/**
 * Ensure the event has an associated listmonk list, creating + persisting it if
 * missing. Returns the numeric list id (0 when listmonk is unavailable).
 */
export async function ensureEventList(ev: Event): Promise<number> {
  if (!listmonkApiConfigured()) return 0;
  if (ev.listmonkListId && ev.listmonkListId > 0) return ev.listmonkListId;
  const id = await createList(eventListName(ev.title, formatDateShortDE(ev.eventDate)));
  if (!id) return 0;
  try {
    await db.update(events).set({ listmonkListId: id }).where(eq(events.id, ev.id));
    ev.listmonkListId = id;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[events] failed to persist listmonk_list_id', ev.id, String(err));
  }
  return id;
}

// ── Event newsletter (public list campaign) ──────────────────────────────────

/**
 * Default invitation copy (grounded in the website's tone) used when the admin
 * doesn't write their own intro. Also pre-filled into the admin textarea.
 * Plain text; paragraphs are separated by a blank line.
 */
export const DEFAULT_EVENT_NEWSLETTER_INTRO = `es ist wieder so weit – der nächste Männerkreis steht an. Ein Abend, an dem wir gemeinsam zur Ruhe kommen, offen sprechen und einander auf Augenhöhe begegnen.

Der Männerkreis ist ein geschützter Raum, in dem du dich zeigen kannst, wie du wirklich bist – ohne Rollen, ohne Bewertung. Es geht um echte Begegnung, gegenseitige Unterstützung und darum, gemeinsam zu wachsen.

Die Teilnehmerzahl ist bewusst klein gehalten. Wenn du dabei sein möchtest, sichere dir deinen Platz – ich freue mich auf dich.`;

/** Escape + paragraph-ize plain text into prose `<p>` blocks (blank line = new ¶). */
function introToProse(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\r?\n/g, '<br />')}</p>`)
    .join('\n');
}

/**
 * Render the *prose body* for the event-announcement campaign. This is injected
 * into the branded listmonk campaign template (`{{ template "content" . }}`),
 * which already provides the masthead, the "Markus" signature, the closing
 * quote and the footer with the unsubscribe / browser links — so the body is
 * content only: intro, the event facts and a clear call-to-action link.
 */
function buildEventNewsletterHtml(ev: Event, intro: string): string {
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
}

/**
 * Send an event announcement to the public newsletter list(s) as a listmonk
 * campaign. Returns a coarse result for the admin UI.
 */
export async function sendEventNewsletter(
  eventId: string,
  subject: string,
  intro: string,
): Promise<{ ok: boolean; campaignId: number; error?: string }> {
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
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

export interface EventInput {
  title: string;
  slug?: string;
  description?: string;
  eventDate: string; // ISO
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

/** All events for the admin list (newest first), incl. unpublished, excl. soft-deleted. */
export async function listEventsForAdmin(): Promise<Array<Event & { activeCount: number }>> {
  const rows = await db.select().from(events).where(isNull(events.deleted)).orderBy(desc(events.eventDate));
  return Promise.all(rows.map(async (ev) => ({ ...ev, activeCount: await countActiveRegistrations(ev.id) })));
}

function inputToColumns(input: EventInput): Partial<NewEvent> {
  return {
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
  };
}

export async function createEvent(input: EventInput): Promise<Event> {
  const slug = input.slug?.trim() || (await generateSlug(input.eventDate));
  const rows = await db
    .insert(events)
    .values({ ...(inputToColumns(input) as NewEvent), slug })
    .returning();
  const created = rows[0];
  // Give the event its own listmonk list up front (best-effort).
  void ensureEventList(created).catch(() => {});
  return created;
}

export async function updateEvent(id: string, input: EventInput): Promise<Event | null> {
  const existing = await getEventById(id);
  if (!existing) return null;
  const slug = input.slug?.trim() || existing.slug || (await generateSlug(input.eventDate, id));
  const rows = await db
    .update(events)
    .set({ ...inputToColumns(input), slug })
    .where(eq(events.id, id))
    .returning();
  const updated = rows[0] ?? null;

  // Keep the listmonk list label in sync on title/date change.
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
}

/** Soft-delete (and unpublish) an event. */
export async function softDeleteEvent(id: string): Promise<void> {
  await db
    .update(events)
    .set({ deleted: new Date().toISOString(), isPublished: false })
    .where(and(eq(events.id, id), isNull(events.deleted)));
}
