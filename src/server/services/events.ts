/**
 * Event query + admin service. Owns the public DTO (with the *computed* capacity
 * values that are never stored), the public read queries used by SSR, and the
 * admin CRUD. Ported from `pb_hooks/lib/domain.js` + `routes_events_public.pb.js`
 * + the slug auto-generation from `events.pb.js`.
 */
import { and, asc, desc, eq, gte, isNull, ne } from 'drizzle-orm';
import type { EventDTO } from '../../lib/types';
import { config } from '../config';
import type { DB } from '../db';
import { newId } from '../db/id';
import { type EventRow, events, registrations } from '../db/schema';

const ACTIVE = ['registered', 'attended'] as const;

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
    ),
  );
}

export function isEventPast(eventDate: Date): boolean {
  const d = eventDate;
  const endOfDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59),
  );
  return endOfDay.getTime() < Date.now();
}

export type EventInput = {
  title: string;
  slug?: string;
  description?: string | null;
  eventDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  locationDetails?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maxParticipants: number;
  costBasis?: string | null;
  isPublished: boolean;
  image?: string | null;
};

export function createEventService(db: DB) {
  async function countActive(eventId: string): Promise<number> {
    const rows = await db
      .select({ status: registrations.status })
      .from(registrations)
      .where(
        and(eq(registrations.event, eventId), isNull(registrations.deleted)),
      );
    return rows.filter((r) => (ACTIVE as readonly string[]).includes(r.status))
      .length;
  }

  async function toDto(ev: EventRow): Promise<EventDTO> {
    const activeCount = await countActive(ev.id);
    const available = Math.max(0, ev.maxParticipants - activeCount);
    return {
      id: ev.id,
      title: ev.title,
      slug: ev.slug,
      description: ev.description ?? '',
      event_date: ev.eventDate.toISOString(),
      start_time: ev.startTime ?? '',
      end_time: ev.endTime ?? '',
      location: ev.location ?? '',
      location_details: ev.locationDetails ?? '',
      street: ev.street ?? '',
      postal_code: ev.postalCode ?? '',
      city: ev.city ?? '',
      latitude: ev.latitude ?? null,
      longitude: ev.longitude ?? null,
      max_participants: ev.maxParticipants,
      cost_basis: ev.costBasis ?? '',
      image_url: ev.image
        ? `${config.APP_URL}/api/files/${ev.id}/${ev.image}`
        : null,
      available_spots: available,
      is_full: available <= 0,
      is_past: isEventPast(ev.eventDate),
    };
  }

  /** The next upcoming published event (or null). */
  async function nextEvent(): Promise<EventDTO | null> {
    const rows = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.isPublished, true),
          isNull(events.deleted),
          gte(events.eventDate, startOfTodayUTC()),
        ),
      )
      .orderBy(asc(events.eventDate))
      .limit(1);
    return rows[0] ? toDto(rows[0]) : null;
  }

  /** A single published event by slug (past or upcoming), or null. */
  async function bySlug(slug: string): Promise<EventDTO | null> {
    const ev = await rowBySlug(slug);
    return ev ? toDto(ev) : null;
  }

  async function rowBySlug(slug: string): Promise<EventRow | null> {
    const rows = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.slug, slug),
          eq(events.isPublished, true),
          isNull(events.deleted),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /** All published, non-deleted events (past + upcoming) as DTOs. */
  async function listPublished(): Promise<EventDTO[]> {
    const rows = await db
      .select()
      .from(events)
      .where(and(eq(events.isPublished, true), isNull(events.deleted)))
      .orderBy(asc(events.eventDate));
    return Promise.all(rows.map(toDto));
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  async function listAll(): Promise<Array<EventRow & { activeCount: number }>> {
    const rows = await db
      .select()
      .from(events)
      .where(isNull(events.deleted))
      .orderBy(desc(events.eventDate));
    return Promise.all(
      rows.map(async (r) => ({ ...r, activeCount: await countActive(r.id) })),
    );
  }

  async function getById(id: string): Promise<EventRow | null> {
    const rows = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Date-based slug "YYYY-MM-DD", de-duplicated with a -2/-3… suffix. */
  async function generateSlug(
    eventDate: Date,
    excludeId?: string,
  ): Promise<string> {
    const base = eventDate.toISOString().slice(0, 10);
    let candidate = base;
    let n = 1;
    while (true) {
      const rows = await db
        .select({ id: events.id })
        .from(events)
        .where(
          excludeId
            ? and(eq(events.slug, candidate), ne(events.id, excludeId))
            : eq(events.slug, candidate),
        )
        .limit(1);
      if (rows.length === 0) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
  }

  async function create(input: EventInput): Promise<EventRow> {
    const slug = input.slug?.trim()
      ? input.slug.trim()
      : await generateSlug(input.eventDate);
    const now = new Date();
    const rows = await db
      .insert(events)
      .values({
        id: newId(),
        title: input.title,
        slug,
        description: input.description ?? null,
        eventDate: input.eventDate,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        location: input.location ?? null,
        locationDetails: input.locationDetails ?? null,
        street: input.street ?? null,
        postalCode: input.postalCode ?? null,
        city: input.city ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        maxParticipants: input.maxParticipants,
        costBasis: input.costBasis ?? null,
        isPublished: input.isPublished,
        image: input.image ?? null,
        created: now,
        updated: now,
      })
      .returning();
    return rows[0];
  }

  async function update(id: string, input: EventInput): Promise<void> {
    const slug = input.slug?.trim()
      ? input.slug.trim()
      : await generateSlug(input.eventDate, id);
    await db
      .update(events)
      .set({
        title: input.title,
        slug,
        description: input.description ?? null,
        eventDate: input.eventDate,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        location: input.location ?? null,
        locationDetails: input.locationDetails ?? null,
        street: input.street ?? null,
        postalCode: input.postalCode ?? null,
        city: input.city ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        maxParticipants: input.maxParticipants,
        costBasis: input.costBasis ?? null,
        isPublished: input.isPublished,
        ...(input.image !== undefined ? { image: input.image } : {}),
        updated: new Date(),
      })
      .where(eq(events.id, id));
  }

  async function remove(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  return {
    countActive,
    toDto,
    nextEvent,
    bySlug,
    rowBySlug,
    listPublished,
    listAll,
    getById,
    create,
    update,
    remove,
  };
}

export type EventService = ReturnType<typeof createEventService>;
