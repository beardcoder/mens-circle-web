/**
 * Client-side API helpers (runtime, browser).
 *
 * Page content (events, testimonials) is server-rendered. These helpers cover
 * the parts that must run in the browser: the form submissions (register /
 * newsletter / testimonial). They POST to the Astro API routes on the same
 * origin (see src/pages/api/*), which validate, run capacity/waitlist logic and
 * send transactional email server-side, returning a uniform { success, message }.
 */
import type { ApiResponse, RegistrationPayload, TestimonialPayload } from './types';

/** POST a JSON body to an API route and normalise the response/errors.
 *
 *  The path stays root-relative: these helpers only ever run in the browser and
 *  the routes are same-origin, so `fetch` resolves them against the current
 *  document without an origin prefix. */
async function postJson(path: string, body: object): Promise<ApiResponse> {
  const res = await fetch(path, {
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
    message: data.message ?? (res.ok ? 'Erfolgreich.' : 'Etwas ist schiefgelaufen. Bitte versuche es später erneut.'),
  };
}

export function registerForEvent(payload: RegistrationPayload): Promise<ApiResponse> {
  return postJson('/api/event/register', payload);
}

export function subscribeNewsletter(email: string, website = ''): Promise<ApiResponse> {
  return postJson('/api/newsletter/subscribe', { email, website });
}

export function submitTestimonial(payload: TestimonialPayload): Promise<ApiResponse> {
  return postJson('/api/testimonial/submit', payload);
}
