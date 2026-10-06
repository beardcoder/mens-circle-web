/** Thin DOM helper. */

type ToastType = 'success' | 'error';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
};

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'Erfolg',
  error: 'Fehler',
};

/** Square, opaque, a coloured bar at the start. It rises in from its
 *  `@starting-style` and leaves through `data-hiding`. */
const TOAST =
  'fixed inset-x-4 top-4 z-50 flex items-start gap-4 rounded-control border border-l-[3px] border-line-strong bg-raised px-5 py-4 font-sans text-fg shadow-toast transition-[opacity,translate] duration-[320ms] ease-settle starting:-translate-y-4 starting:opacity-0 data-[hiding]:pointer-events-none data-[hiding]:-translate-y-3 data-[hiding]:opacity-0 motion-reduce:starting:translate-y-0 motion-reduce:data-[hiding]:translate-y-0 md:left-auto md:w-[26rem]';

const TONES: Record<ToastType, { bar: string; icon: string; title: string }> = {
  success: { bar: 'border-l-success', icon: 'bg-success', title: 'text-success' },
  error: { bar: 'border-l-danger', icon: 'bg-danger', title: 'text-danger' },
};

const VISIBLE_MS = 5000;
const EXIT_FALLBACK_MS = 400;

function buildToast(type: ToastType, message: string, title?: string): HTMLDivElement {
  const toast = document.createElement('div');

  toast.className = `${TOAST} ${TONES[type].bar}`;

  // Problems interrupt, confirmations wait for a pause. `role="alert"` already
  // implies `aria-live="assertive"`, so never pair it with an explicit politeness.
  const urgent = type === 'error';

  toast.role = urgent ? 'alert' : 'status';
  toast.ariaLive = urgent ? 'assertive' : 'polite';
  // One message: read title and body together rather than whichever text node
  // happened to change.
  toast.ariaAtomic = 'true';

  const icon = document.createElement('div');

  icon.className = `grid size-6.5 shrink-0 place-items-center rounded-full text-sm leading-none font-bold text-ground ${TONES[type].icon}`;
  icon.textContent = ICONS[type];
  icon.ariaHidden = 'true';

  const content = document.createElement('div');

  content.className = 'flex min-w-0 flex-1 flex-col gap-1';

  const titleEl = document.createElement('div');

  // The marker register: one short status word is a label, not a sentence.
  titleEl.className = `text-xs leading-tight font-semibold tracking-label uppercase ${TONES[type].title}`;
  titleEl.textContent = title ?? DEFAULT_TITLES[type];

  const messageEl = document.createElement('div');

  messageEl.className = 'text-sm leading-normal text-fg';
  messageEl.textContent = message;

  content.append(titleEl, messageEl);
  toast.append(icon, content);

  return toast;
}

export function showToast(type: ToastType, message: string, title?: string): void {
  const toast = buildToast(type, message, title);

  document.body.append(toast);

  const dismiss = (): void => {
    if (!toast.isConnected) return;

    toast.dataset.hiding = '';

    const remove = (): void => toast.remove();

    toast.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, EXIT_FALLBACK_MS);
  };

  window.setTimeout(dismiss, VISIBLE_MS);
}
