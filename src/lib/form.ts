/**
 * Shared plumbing for the three public forms (registration, newsletter,
 * testimonial). A toast alone never says which field is wrong, so these add
 * `aria-invalid`, a message beside the field, and focus on the first offender;
 * `submitForm` then runs the one submit lifecycle all three share.
 */
import { prefersReducedMotion } from './helpers';
import { showToast } from './toast';
import type { ApiResponse } from './types';
import { trackEvent, type UmamiEventData } from './umami';

/** Field name → error message. Empty means valid. */
export type FieldErrors = Record<string, string>;

/** Namespaced per form — a page can host several. */
export const errorId = (form: string, field: string): string => `${form}-${field}-error`;

/** Undefined rather than empty when there is nothing to point at. */
export const describedBy = (form: string, field: string, hasError: boolean, hintId?: string): string | undefined =>
  [hasError ? errorId(form, field) : null, hintId].filter(Boolean).join(' ') || undefined;

/** Drop one field's error, so it clears as the user starts correcting it. */
export function withoutError(errors: FieldErrors, field: string): FieldErrors {
  if (!errors[field]) return errors;
  const { [field]: _cleared, ...rest } = errors;
  return rest;
}

/**
 * Focus the first invalid field. Waits a microtask so Svelte has flushed the
 * `aria-invalid` attributes, and picks by DOM order rather than validation
 * order — the topmost problem, not the first rule that happened to fail.
 */
async function focusFirstInvalid(root: HTMLElement | null | undefined): Promise<void> {
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

export interface SubmitOptions {
  form: HTMLFormElement | undefined;
  /** The field errors, empty when everything is good. */
  validate: () => FieldErrors;
  setErrors: (errors: FieldErrors) => void;
  setSubmitting: (value: boolean) => void;
  /** Umami event names for the three outcomes. */
  events: { submit: string; success: string; error: string };
  /** Extra analytics context, sent with every one of them. */
  context?: UmamiEventData;
  send: () => Promise<ApiResponse>;
  /** Clear the fields once the submission was accepted. */
  reset: () => void;
}

/**
 * Validate, submit, report. The inline messages carry the detail, so the toast
 * is only ever the summary, and a network failure is reported in the same
 * words as a rejection from the endpoint.
 */
export async function submitForm(options: SubmitOptions): Promise<void> {
  const errors = options.validate();
  options.setErrors(errors);

  if (Object.keys(errors).length > 0) {
    showToast('error', Object.values(errors)[0] ?? 'Bitte prüfe deine Eingaben.');
    await focusFirstInvalid(options.form);
    return;
  }

  trackEvent(options.events.submit, options.context);
  options.setSubmitting(true);

  try {
    const { success, message } = await options.send();
    showToast(success ? 'success' : 'error', message);

    if (success) {
      trackEvent(options.events.success, options.context);
      options.reset();
    } else {
      trackEvent(options.events.error, { ...options.context, error: message });
    }
  } catch (cause) {
    showToast('error', 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
    trackEvent(options.events.error, {
      ...options.context,
      error: cause instanceof Error ? cause.message : 'Network error',
    });
  } finally {
    options.setSubmitting(false);
  }
}
