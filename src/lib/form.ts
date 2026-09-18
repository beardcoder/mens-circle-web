/**
 * Client side of the three public forms (registration, newsletter, testimonial).
 * Each posts its FormData to an Astro Action; the action's schema is the only
 * validation. Its input errors come back per field and are written beside the
 * field — `aria-invalid`, the message, focus on the first offender — because a
 * toast alone never says which field is wrong.
 *
 * Markup contract:
 *   <form data-form="…" id="…">            wired by `enhanceForms`
 *   <… id="{form.id}-{name}-error" hidden>  where a field's message goes
 *   data-track="…"                          Umami events `<track>-submit|success|error`
 *   data-track-context='{"…": "…"}'         extra analytics data for them
 */
import { isInputError } from 'astro:actions';
import { prefersReducedMotion } from './helpers';
import { showToast } from './toast';
import { trackEvent } from './umami';

type ActionCall = (input: FormData) => Promise<{ data?: { message: string }; error?: Error }>;

const FAILED = 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';

function enhance(form: HTMLFormElement, action: ActionCall): void {
  // Taken over only now, not in the markup: before this runs, a static
  // `novalidate` would let an empty submit through as a native GET.
  form.noValidate = true;

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const idleLabel = submit?.textContent ?? '';
  const track = form.dataset.track ?? 'form';
  const context = JSON.parse(form.dataset.trackContext || '{}') as Record<string, string>;

  /** Field name → message; empty means valid. */
  let errors: Record<string, string> = {};
  const render = (): void => {
    for (const control of form.querySelectorAll<HTMLInputElement>('[name]')) {
      const message = errors[control.name] ?? '';
      const slot = document.getElementById(`${form.id}-${control.name}-error`);
      if (slot) {
        slot.textContent = message;
        slot.hidden = !message;
      }
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    }
  };

  // A field's message clears as soon as it is being corrected.
  form.addEventListener('input', (event) => {
    const { name } = event.target as HTMLInputElement;
    if (!errors[name]) return;
    errors = { ...errors, [name]: '' };
    render();
  });

  const setBusy = (busy: boolean): void => {
    for (const control of form.elements) (control as HTMLInputElement).disabled = busy;
    if (submit) submit.textContent = busy ? 'Wird gesendet …' : idleLabel;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    trackEvent(`${track}-submit`, context);

    // Read before disabling: disabled controls are left out of FormData.
    const body = new FormData(form);
    setBusy(true);
    const { data, error } = await action(body).catch(() => ({ data: undefined, error: new Error(FAILED) }));
    setBusy(false);

    errors = isInputError(error)
      ? Object.fromEntries(Object.entries(error.fields).map(([name, messages]) => [name, messages?.[0] ?? '']))
      : {};
    render();

    if (data) {
      showToast('success', data.message);
      trackEvent(`${track}-success`, context);
      form.reset();
      return;
    }

    // DOM order, not schema order: the topmost problem, not the first rule checked.
    const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    const message = (first && errors[first.getAttribute('name') ?? '']) || error?.message || FAILED;
    showToast('error', message);
    trackEvent(`${track}-error`, { ...context, error: message });
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
  });
}

/** Wire every `form[data-form="<name>"]` on the page to its action. */
export function enhanceForms(name: string, action: ActionCall): void {
  for (const form of document.querySelectorAll<HTMLFormElement>(`form[data-form="${name}"]`)) enhance(form, action);
}
