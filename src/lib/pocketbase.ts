/**
 * Client-side API helpers (runtime, browser).
 *
 * Page content (events, testimonials) is server-rendered (see
 * `pocketbase-server.ts`). The helpers here cover the parts that must run in
 * the browser: the form submissions (register / newsletter / testimonial).
 * They use plain `fetch` against the same-origin `/api/*` endpoints.
 *
 * The backend now lives in-process in the Astro/Bun server (see `src/server/`),
 * so the endpoints are always same-origin — no separate base URL to configure.
 *
 * All write endpoints validate, run capacity/waitlist logic and send the
 * transactional email server-side, returning a uniform { success, message }.
 */
import type {
  ApiResponse,
  RegistrationPayload,
  TestimonialPayload,
} from './types';

function resolveBaseUrl(): string {
  if (globalThis.window !== undefined) return globalThis.location.origin;
  return '';
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
