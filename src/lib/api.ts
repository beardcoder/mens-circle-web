/**
 * Browser-side helpers for the three form submissions. They POST to the Astro
 * API routes on the same origin (src/pages/api/*), which validate, run the
 * capacity/waitlist logic and send mail, returning `{ success, message }`.
 */
import type { ApiResponse, RegistrationPayload, TestimonialPayload } from './types';

/** POST a JSON body to an API route and normalise the response and errors. */
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
