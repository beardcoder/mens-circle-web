/**
 * Build-time PocketBase data fetchers (server-only).
 *
 * Events and testimonials are rendered statically into the HTML at build time
 * (best SEO/performance, no client loading flash). A PocketBase hook pings the
 * deploy webhook whenever those records change, so the static site is rebuilt
 * and the new content goes live (see pocketbase/pb_hooks/deploy.pb.js).
 *
 * This module is imported ONLY from `.astro` frontmatter and `getStaticPaths`,
 * which run in Node/Bun at build time — never in the browser. It therefore
 * reads the production PocketBase URL from a server-side env var.
 *
 * Resolution order for the build-time base URL:
 *   1. PB_URL          — server-only, the live PocketBase (set this in CI/Coolify)
 *   2. PUBLIC_PB_URL   — also used by the client in local dev
 *   3. http://localhost:8090 — local PocketBase default
 *
 * Every fetch is fault-tolerant: on a network error or non-OK response it
 * returns an empty result. This keeps the very first deploy working even when
 * no PocketBase is reachable yet (the pages render their graceful empty state).
 */
import type { EventDTO, Testimonial } from './types';

const BUILD_PB_URL = (
  process.env.PB_URL ||
  process.env.PUBLIC_PB_URL ||
  'http://localhost:8090'
).replace(/\/$/, '');

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BUILD_PB_URL}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Published testimonials, sorted, for static rendering. Empty on failure. */
export async function fetchTestimonials(): Promise<Testimonial[]> {
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
}

/** All published events (past + upcoming) as DTOs. Empty on failure. */
export async function fetchAllEvents(): Promise<EventDTO[]> {
  const data = await getJson<{ events?: EventDTO[] }>('/api/public/events');
  return data?.events ?? [];
}

/** The next upcoming published event, or null if none is scheduled. */
export async function fetchNextEvent(): Promise<EventDTO | null> {
  const data = await getJson<{ event: EventDTO | null }>(
    '/api/public/events/next',
  );
  return data?.event ?? null;
}
