/**
 * Client-side PocketBase API helpers (runtime, browser).
 *
 * Static content (events, testimonials) is fetched at BUILD time in
 * `pocketbase-build.ts`. The helpers here cover the parts that must stay live
 * in the browser: form submissions (register / newsletter / testimonial) and
 * the event page's live capacity refresh. They use plain `fetch` against the
 * custom PocketBase routes — no PocketBase JS SDK is shipped to the client.
 *
 * In production the Astro build is served BY PocketBase on the same origin,
 * so the default base URL is the current origin. For local dev set
 * `PUBLIC_PB_URL` (e.g. http://localhost:8090) because Astro's dev server
 * runs on a different port than PocketBase.
 *
 * All write endpoints are custom PocketBase routes (see pocketbase/pb_hooks)
 * that perform validation, capacity/waitlist logic and transactional email
 * server-side, returning a uniform { success, message } body.
 */
import type {
  ApiResponse,
  EventDTO,
  RegistrationPayload,
  TestimonialPayload,
} from './types';

function resolveBaseUrl(): string {
  const configured = import.meta.env.PUBLIC_PB_URL;
  if (configured) return configured;
  if (globalThis.window !== undefined) return globalThis.location.origin;
  return 'http://localhost:8090';
}

export const PB_BASE_URL = resolveBaseUrl();

/** POST a JSON body to a custom route and normalise the response/errors. */
async function postJson(path: string, body: object): Promise<ApiResponse> {
  const res = await fetch(`${PB_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  let data: Partial<ApiResponse> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON / empty body
  }

  return {
    success: res.ok && data.success !== false,
    message:
      data.message ??
      (res.ok
        ? 'Erfolgreich.'
        : 'Etwas ist schiefgelaufen. Bitte versuche es später erneut.'),
  };
}

export function registerForEvent(
  payload: RegistrationPayload,
): Promise<ApiResponse> {
  return postJson('/api/event/register', payload);
}

export function subscribeNewsletter(
  email: string,
  website = '',
): Promise<ApiResponse> {
  return postJson('/api/newsletter/subscribe', { email, website });
}

export function submitTestimonial(
  payload: TestimonialPayload,
): Promise<ApiResponse> {
  return postJson('/api/testimonial/submit', payload);
}

/** Fetch a single event by slug (past or upcoming), or null if not found. */
export async function getEventBySlug(slug: string): Promise<EventDTO | null> {
  try {
    const res = await fetch(
      `${PB_BASE_URL}/api/public/events/${encodeURIComponent(slug)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { event: EventDTO | null };
    return data.event ?? null;
  } catch {
    return null;
  }
}
