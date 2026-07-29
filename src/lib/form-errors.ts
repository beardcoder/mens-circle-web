/**
 * Client-side form validation plumbing shared by the three public forms
 * (event registration, newsletter, testimonial).
 *
 * The forms used to report a rejected field through a toast and nothing else.
 * A toast is the wrong instrument on its own: it vanishes after five seconds,
 * it never says *which* field is wrong, and it leaves focus on the submit
 * button, so anyone not scanning the whole form visually — screen-reader and
 * keyboard users especially — is told "something is wrong" and left to hunt.
 *
 * The pieces here fix the three halves of that:
 *   • `aria-invalid` on the field, so the invalid state is exposed to
 *     assistive tech and drives the styling (see components/_forms.css).
 *   • `aria-describedby` pointing at a visible message next to the field, so
 *     the reason is announced when the field is reached and stays on screen
 *     until corrected.
 *   • focus moved to the first offending field, so the fix is one keystroke
 *     away instead of a hunt.
 *
 * The toast stays as the summary — it just isn't the only channel any more.
 */
import { prefersReducedMotion } from './helpers';

/** A map of field name → German error message. Empty means valid. */
export type FieldErrors = Record<string, string>;

/**
 * The DOM id for a field's message, so `aria-describedby` and the element that
 * renders it always agree. Namespaced per form because a page can host more
 * than one (the home page has a newsletter block below the content).
 */
export const errorId = (form: string, field: string): string => `${form}-${field}-error`;

/**
 * `aria-describedby` value for a field: its error message when invalid, plus
 * any always-present hint. Returns undefined when there is nothing to point
 * at — an empty `aria-describedby` is a dangling reference, not a no-op.
 */
export const describedBy = (form: string, field: string, hasError: boolean, hintId?: string): string | undefined =>
  [hasError ? errorId(form, field) : null, hintId].filter(Boolean).join(' ') || undefined;

/**
 * Move focus to the first field the browser considers invalid, scrolling it
 * into view. Runs after the microtask queue so Svelte has flushed the
 * `aria-invalid` attributes this reads.
 *
 * Deliberately ordered by DOM position rather than by validation order: the
 * user should land on the topmost problem, which is not necessarily the first
 * rule that happened to fail.
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
 * Hand validation from the browser to us — but only once we're actually running.
 *
 * `novalidate` must NOT be hardcoded in the markup. These forms are
 * `client:visible` islands, so there is a window between first paint and
 * hydration in which no JS is listening: a static `novalidate` would strip the
 * browser's own checks during exactly that window and let an empty submit
 * through as a native GET, navigating away and losing what was typed. Setting
 * the flag from script means the native constraints guard the gap and our
 * richer messaging takes over the moment it can.
 */
export function takeOverValidation(form: HTMLFormElement | null | undefined): void {
  if (form) form.noValidate = true;
}

/** First error message in insertion order, for the toast summary. */
export const firstError = (errors: FieldErrors): string | undefined => Object.values(errors)[0];
