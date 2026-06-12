/**
 * Server-side PocketBase data fetchers (SSR + build, never the browser).
 *
 * Events and testimonials are rendered on the server: the SSR pages (`/event`,
 * `/event/[slug]`, `/`) fetch live data from PocketBase at request time, so a
 * content change in the admin shows up immediately — no rebuild, no deploy
 * webhook. The prerendered pages (legal, atemübung, testimonial form) call
 * these at build time; PocketBase is usually unreachable then, so every fetch
 * fails open (see below) and the layout keeps the event CTAs visible.
 *
 * This module is imported ONLY from `.astro` frontmatter — it runs in the Bun
 * runtime on the server, never in the client bundle.
 *
 * Base URL resolution:
 *   1. PB_INTERNAL_URL — runtime loopback to the co-located PocketBase
 *      (the production default is http://127.0.0.1:8091, set by the entrypoint)
 *   2. PUBLIC_PB_URL   — local dev, when Astro and PocketBase run on different ports
 *   3. http://127.0.0.1:8091 — fallback
 *
 * Every fetch is fault-tolerant: on a network error or non-OK response it
 * returns an empty result, so a (briefly) unreachable PocketBase degrades to a
 * graceful empty state instead of a 500.
 */
import type { EventDTO, Testimonial } from './types';

const PB_URL = (
  process.env.PB_INTERNAL_URL ||
  process.env.PUBLIC_PB_URL ||
  'http://127.0.0.1:8091'
).replace(/\/$/, '');

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PB_URL}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Tiny in-memory TTL cache ────────────────────────────────────────────────
// Keeps the SSR pages cheap and sustainable: the rarely-changing "are there any
// upcoming events?" flag (queried in the shared layout on *every* page) and the
// testimonials list are fetched from PocketBase at most once per TTL window,
// shared across all concurrent requests of the long-lived Bun process. Volatile
// data (an event's free spots) is intentionally NOT cached so capacity stays
// live.
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Published testimonials, sorted. Cached for {@link TTL_MS}. Empty on failure. */
export function fetchTestimonials(): Promise<Testimonial[]> {
  return cached('testimonials', async () => {
    const data = await getJson<{ items?: Array<Record<string, unknown>> }>(
      '/api/collections/testimonials/records' +
        '?perPage=200&filter=' +
        encodeURIComponent('is_published = true') +
        '&sort=' +
        encodeURIComponent('sort_order,-published_at'),
    );
    const items = data?.items ?? [];
    return items.map((r) => ({
      quote: String(r.quote ?? ''),
      author: r.author_name ? String(r.author_name) : null,
      role: r.role ? String(r.role) : null,
    }));
  });
}

/** The next upcoming published event, or null if none. Not cached (live capacity). */
export async function fetchNextEvent(): Promise<EventDTO | null> {
  const data = await getJson<{ event: EventDTO | null }>(
    '/api/public/events/next',
  );
  return data?.event ?? null;
}

/** A single event by slug (past or upcoming), or null. Not cached (live capacity). */
export async function getEventBySlug(slug: string): Promise<EventDTO | null> {
  const data = await getJson<{ event: EventDTO | null }>(
    `/api/public/events/${encodeURIComponent(slug)}`,
  );
  return data?.event ?? null;
}

/**
 * Whether an upcoming event is scheduled — drives the event CTAs in the shared
 * layout. Cached for {@link TTL_MS} since it is queried on every page.
 *
 * Returns `null` when PocketBase is unreachable (e.g. at build time for the
 * prerendered pages) so callers can *fail open* and keep the CTAs visible.
 */
export function hasUpcomingEvent(): Promise<boolean | null> {
  return cached('has-upcoming-event', () =>
    getJson<{ event: EventDTO | null }>('/api/public/events/next').then(
      (data) => (data === null ? null : data.event !== null),
    ),
  );
}
