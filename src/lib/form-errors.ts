/**
 * Client-side validation plumbing for the three public forms (registration,
 * newsletter, testimonial). A toast alone never says *which* field is wrong, so
 * these helpers add `aria-invalid`, an `aria-describedby` message beside the
 * field, and focus on the first offender. The toast stays as the summary.
 */
import { prefersReducedMotion } from './helpers';

/** A map of field name → German error message. Empty means valid. */
export type FieldErrors = Record<string, string>;

/** Id for a field's message. Namespaced per form — a page can host several. */
export const errorId = (form: string, field: string): string => `${form}-${field}-error`;

/**
 * `aria-describedby` for a field: its error when invalid, plus any hint.
 * Undefined when there is nothing to point at — an empty value dangles.
 */
export const describedBy = (form: string, field: string, hasError: boolean, hintId?: string): string | undefined =>
  [hasError ? errorId(form, field) : null, hintId].filter(Boolean).join(' ') || undefined;

/**
 * Focus the first invalid field and scroll it into view. Waits a microtask so
 * Svelte has flushed the `aria-invalid` attributes this reads, and picks by DOM
 * order rather than validation order — the topmost problem, not the first rule
 * that happened to fail.
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
 * Take validation over from the browser, but only once we are running.
 * `novalidate` must not be in the markup: these are `client:visible` islands,
 * and during the gap before hydration a static flag would let an empty submit
 * through as a native GET, losing what was typed.
 */
export function takeOverValidation(form: HTMLFormElement | null | undefined): void {
  if (form) form.noValidate = true;
}

/** First error message in insertion order, for the toast summary. */
export const firstError = (errors: FieldErrors): string | undefined => Object.values(errors)[0];
