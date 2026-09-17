/**
 * Client-side validation plumbing for the three public forms. A toast alone
 * never says which field is wrong, so these add `aria-invalid`, a message
 * beside the field, and focus on the first offender.
 */
import { prefersReducedMotion } from './helpers';

/** Field name → error message. Empty means valid. */
export type FieldErrors = Record<string, string>;

/** Namespaced per form — a page can host several. */
export const errorId = (form: string, field: string): string => `${form}-${field}-error`;

/** Undefined rather than empty when there is nothing to point at. */
export const describedBy = (form: string, field: string, hasError: boolean, hintId?: string): string | undefined =>
  [hasError ? errorId(form, field) : null, hintId].filter(Boolean).join(' ') || undefined;

/**
 * Focus the first invalid field. Waits a microtask so Svelte has flushed the
 * `aria-invalid` attributes, and picks by DOM order rather than validation
 * order — the topmost problem, not the first rule that happened to fail.
 */
export async function focusFirstInvalid(root: HTMLElement | null | undefined): Promise<void> {
  if (!root) return;
  await Promise.resolve();

  const field = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!field) return;

  field.focus({ preventScroll: true });
  field.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
}

/**
 * Take validation over from the browser, but only once hydrated. `novalidate`
 * must not be in the markup: before hydration a static flag would let an empty
 * submit through as a native GET, losing what was typed.
 */
export function takeOverValidation(form: HTMLFormElement | null | undefined): void {
  if (form) form.noValidate = true;
}

/** First error message in insertion order, for the toast summary. */
export const firstError = (errors: FieldErrors): string | undefined => Object.values(errors)[0];
