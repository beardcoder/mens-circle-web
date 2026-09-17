/**
 * The vocabulary the registration and testimonial forms share: one
 * `{ status, body }` envelope and one wording per rejection, so the two cannot
 * tell a visitor different things about the same mistake.
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

/** The islands send JSON `true`, a plain form post sends `'true'` or `'1'`. */
export const consented = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';

/**
 * The honeypot was filled. Callers answer with the success a real visitor would
 * have got — an error names the field that gave it away — and store nothing.
 */
export const isHoneypotFilled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

export const MISSING_CONSENT = 'Bitte bestätige die Datenschutzerklärung.';
export const INVALID_EMAIL = 'Bitte gib eine gültige E-Mail-Adresse an.';
