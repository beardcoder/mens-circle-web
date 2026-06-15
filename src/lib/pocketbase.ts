/**
 * Client-side API helpers (runtime, browser).
 *
 * Page content (events, testimonials) is server-rendered (see
 * `pocketbase-server.ts`). The helpers here cover the parts that must run in
 * the browser: the form submissions (register / newsletter / testimonial).
 * They use plain `fetch` against the EmDash API routes served by the same Bun
 * process — no separate backend, no SDK shipped to the client.
 *
 * In production the single Bun process serves everything on the same origin.
 * For local dev set `PUBLIC_API_URL` if needed (though it's the same origin).
 *
 * All write endpoints perform validation, capacity/waitlist logic and
 * transactional email server-side, returning a uniform { success, message } body.
 */
import type {
  ApiResponse,
  RegistrationPayload,
  TestimonialPayload,
} from './types';

function resolveBaseUrl(): string {
  const configured =
    import.meta.env.PUBLIC_API_URL || import.meta.env.PUBLIC_PB_URL;
  if (configured) return configured;
  if (globalThis.window !== undefined) return globalThis.location.origin;
  return 'http://localhost:4321';
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
