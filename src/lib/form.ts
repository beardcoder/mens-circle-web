/**
 * Client side of the newsletter and testimonial forms (the registration form is its
 * Preact island). Every answer stays at the form: a field's message under the field,
 * the form's own result under its button (`<form id>-status`). Entries survive an error.
 */

/** The actions these forms call; each takes the form's `FormData`. */
type FormAction = 'subscribeNewsletter' | 'submitTestimonial';

type Outcome = { message: string; fields: Record<string, string> } | { error: string; fields: Record<string, string> };

const FAILED = 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';

/** The actions client (about 8 kB) loads on the first focus in a form, not with the page. */
let client: Promise<typeof import('astro:actions')> | undefined;

const loadActions = () => (client ??= import('astro:actions'));

/** Calls the action; field messages by name, or a failure that never leaks an internal error. */
async function send(name: FormAction, body: FormData): Promise<Outcome> {
  try {
    const { actions, isInputError } = await loadActions();
    const { data, error } = await actions[name](body);

    if (data) return { message: data.message, fields: {} };

    const fields = isInputError(error)
      ? Object.fromEntries(Object.entries(error.fields).map(([field, messages]) => [field, messages?.[0] ?? '']))
      : {};

    return { error: error?.message || FAILED, fields };
  } catch {
    // The client or the request failed (offline, timeout).
    client = undefined;

    return { error: FAILED, fields: {} };
  }
}

/** Programmatic Umami events; analytics must never break a form. */
function trackEvent(eventName: string, eventData?: Record<string, string>): void {
  try {
    window.umami?.track(eventName, eventData);
  } catch {
    // Ignored.
  }
}

function enhance(form: HTMLFormElement, action: FormAction): void {
  // Taken over only now, not in the markup: before this runs, a static
  // `novalidate` would let an empty submit through as a native GET.
  form.noValidate = true;
  form.addEventListener('focusin', () => void loadActions().catch(() => {}), { once: true });

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  // Only the words change while sending; the button's seat and arrow stay.
  const submitLabel = submit?.querySelector<HTMLElement>('[data-label]') ?? submit;
  const idleLabel = submitLabel?.textContent ?? '';
  const track = form.dataset.track ?? 'form';
  const context = JSON.parse(form.dataset.trackContext || '{}') as Record<string, string>;

  const status = document.getElementById(`${form.id}-status`);

  /** The form's own line: what happened, or nothing. */
  const say = (tone: 'success' | 'error' | null, message = ''): void => {
    if (!status) return;

    status.textContent = message;
    status.hidden = tone === null;

    if (tone) status.dataset.tone = tone;
    else delete status.dataset.tone;
  };

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

    if (submitLabel) submitLabel.textContent = busy ? 'Wird gesendet …' : idleLabel;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    trackEvent(`${track}-submit`, context);

    // Read before disabling: disabled controls are left out of FormData.
    const body = new FormData(form);

    say(null);
    setBusy(true);
    const outcome = await send(action, body);

    setBusy(false);
    errors = outcome.fields;
    render();

    if ('message' in outcome) {
      say('success', outcome.message);
      trackEvent(`${track}-success`, context);
      form.reset();

      return;
    }

    // DOM order, not schema order: the topmost problem, not the first rule checked.
    const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    const message = (first && errors[first.getAttribute('name') ?? '']) || outcome.error;

    say('error', first ? 'Bitte prüfe die markierten Angaben.' : message);
    trackEvent(`${track}-error`, { ...context, error: message });
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  });
}

/** Wire every `form[data-form="<name>"]` on the page to its action. */
export function enhanceForms(name: string, action: FormAction): void {
  for (const form of document.querySelectorAll<HTMLFormElement>(`form[data-form="${name}"]`)) enhance(form, action);
}
