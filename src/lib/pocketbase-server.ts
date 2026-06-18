/**
 * Server-side content fetchers (SSR, never the browser).
 *
 * Events and testimonials are rendered on the SSR pages / server islands at
 * request time, so a content change in the admin shows up immediately — no
 * rebuild, no deploy webhook.
 *
 * These used to fetch over HTTP from a co-located PocketBase. The backend now
 * lives in-process (Bun + SQLite, see `src/server/`), so they call the service
 * layer directly — no network hop. Every call is fault-tolerant: on any error
 * it degrades to an empty result instead of a 500.
 *
 * This module is imported ONLY from `.astro` frontmatter / server islands — it
 * runs in the Bun runtime on the server, never in the client bundle.
 */
import { getServices } from '../server/container';
import type { EventDTO, Testimonial } from './types';

/** Published testimonials, sorted. Empty on failure. */
export async function fetchTestimonials(): Promise<Testimonial[]> {
  try {
    return await getServices().testimonials.listPublished();
  } catch (err) {
    console.error('fetchTestimonials failed', String(err));
    return [];
  }
}

/** The next upcoming published event, or null if none. */
export async function fetchNextEvent(): Promise<EventDTO | null> {
  try {
    return await getServices().events.nextEvent();
  } catch (err) {
    console.error('fetchNextEvent failed', String(err));
    return null;
  }
}

/** A single published event by slug (past or upcoming), or null. */
export async function getEventBySlug(slug: string): Promise<EventDTO | null> {
  try {
    return await getServices().events.bySlug(slug);
  } catch (err) {
    console.error('getEventBySlug failed', String(err));
    return null;
  }
}
