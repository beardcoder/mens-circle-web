/**
 * Server-side data fetchers (SSR, never the browser).
 *
 * Events are rendered on the SSR pages (`/event`, `/event/[slug]`) at request
 * time, and testimonials in the home page's server island — so a content change
 * shows up immediately, no rebuild, no deploy webhook.
 *
 * This module queries the embedded bun:sqlite database directly (EmDash),
 * replacing the former PocketBase HTTP fetches. It runs in the Bun runtime on
 * the server, never in the client bundle.
 *
 * Every query is fault-tolerant: on error it returns an empty result, so a
 * database issue degrades to a graceful empty state instead of a 500.
 */
import type { EventDTO, Testimonial } from './types';
import { getDb } from '../../server/db.ts';
import { isEventPast } from '../../server/lib.ts';

interface EventRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  location_details: string;
  street: string;
  postal_code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  max_participants: number;
  cost_basis: string;
  image_url: string | null;
  is_published: number;
  deleted_at: string | null;
}

function countActiveRegistrations(eventId: string): number {
  try {
    const db = getDb();
    const row = db
      .query(
        `SELECT COUNT(*) as cnt FROM registrations
         WHERE event_id = ? AND deleted_at IS NULL
         AND (status = 'registered' OR status = 'attended')`,
      )
      .get(eventId) as { cnt: number } | null;
    return row?.cnt ?? 0;
  } catch {
    return 0;
  }
}

function toEventDTO(ev: EventRow): EventDTO {
  const activeCount = countActiveRegistrations(ev.id);
  const available = Math.max(0, ev.max_participants - activeCount);
  return {
    id: ev.id,
    title: ev.title,
    slug: ev.slug,
    description: ev.description,
    event_date: ev.event_date,
    start_time: ev.start_time,
    end_time: ev.end_time,
    location: ev.location,
    location_details: ev.location_details,
    street: ev.street,
    postal_code: ev.postal_code,
    city: ev.city,
    latitude: ev.latitude,
    longitude: ev.longitude,
    max_participants: ev.max_participants,
    cost_basis: ev.cost_basis,
    image_url: ev.image_url,
    available_spots: available,
    is_full: available <= 0,
    is_past: isEventPast(ev as any),
  };
}

// ── Tiny in-memory TTL cache ────────────────────────────────────────────────
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string, load: () => T): T {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Published testimonials, sorted. Cached for {@link TTL_MS}. Empty on failure. */
export function fetchTestimonials(): Promise<Testimonial[]> {
  return Promise.resolve(
    cached('testimonials', () => {
      try {
        const db = getDb();
        const rows = db
          .query(
            `SELECT quote, author_name, role FROM testimonials
             WHERE is_published = 1 AND deleted_at IS NULL
             ORDER BY sort_order ASC, published_at DESC`,
          )
          .all() as Array<{ quote: string; author_name: string; role: string }>;

        return rows.map((r) => ({
          quote: r.quote,
          author: r.author_name || null,
          role: r.role || null,
        }));
      } catch {
        return [];
      }
    }),
  );
}

/** The next upcoming published event, or null if none. Not cached (live capacity). */
export async function fetchNextEvent(): Promise<EventDTO | null> {
  try {
    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
      ),
    )
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '');

    const ev = db
      .query(
        `SELECT * FROM events
         WHERE is_published = 1 AND deleted_at IS NULL AND event_date >= ?
         ORDER BY event_date ASC LIMIT 1`,
      )
      .get(startOfToday) as EventRow | null;

    if (!ev) return null;
    return toEventDTO(ev);
  } catch {
    return null;
  }
}

/** A single event by slug (past or upcoming), or null. Not cached (live capacity). */
export async function getEventBySlug(slug: string): Promise<EventDTO | null> {
  try {
    const db = getDb();
    const ev = db
      .query(
        'SELECT * FROM events WHERE slug = ? AND is_published = 1 AND deleted_at IS NULL',
      )
      .get(slug) as EventRow | null;

    if (!ev) return null;
    return toEventDTO(ev);
  } catch {
    return null;
  }
}
