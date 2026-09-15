/**
 * The vocabulary the two public forms share — registration and testimonial.
 *
 * Both answer with the same `{ status, body }` envelope and reject on the same
 * grounds: an unticked privacy box, a filled honeypot, a malformed address. The
 * wording and the status codes live here once so the two modules cannot drift
 * into telling a visitor two different things about the same mistake.
 */
import type { ApiResponse } from '../types';

/** HTTP status plus the JSON body the Svelte island renders. */
export interface FormResult {
  status: number;
  body: ApiResponse;
}

export const accepted = (message: string): FormResult => ({ status: 200, body: { success: true, message } });

export const rejected = (status: number, message: string): FormResult => ({
  status,
  body: { success: false, message },
});

/**
 * Consent, as it survives the round trip through a form post.
 *
 * The islands send JSON `true`, but a plain form submission sends the string
 * `'true'` (or `'1'`), and neither may be read as a refusal.
 */
export const consented = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

/**
 * A bot filled the field that is hidden from people.
 *
 * Callers answer these with the success they would have sent a real visitor —
 * an error would tell the bot which field gave it away — and store nothing.
 */
export const isHoneypotFilled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

export const MISSING_CONSENT = 'Bitte bestätige die Datenschutzerklärung.';
export const INVALID_EMAIL = 'Bitte gib eine gültige E-Mail-Adresse an.';
