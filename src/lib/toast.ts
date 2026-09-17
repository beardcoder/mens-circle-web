/**
 * Thin DOM helper. All entry/exit motion lives in CSS via `@starting-style` and
 * `.toast--hiding`; this only appends the element and removes it on expiry.
 */

type ToastType = 'success' | 'error';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
};

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'Erfolg',
  error: 'Fehler',
};

const VISIBLE_MS = 5000;
const EXIT_FALLBACK_MS = 400;

function buildToast(type: ToastType, message: string, title?: string): HTMLDivElement {
  const toast = document.createElement('div');

  toast.className = `toast toast--${type}`;

  // Problems interrupt, confirmations wait for a pause. `role="alert"` already
  // implies `aria-live="assertive"`, so never pair it with an explicit politeness.
  const urgent = type === 'error';

  toast.role = urgent ? 'alert' : 'status';
  toast.ariaLive = urgent ? 'assertive' : 'polite';
  // One message: read title and body together rather than whichever text node
  // happened to change.
  toast.ariaAtomic = 'true';

  const icon = document.createElement('div');

  icon.className = 'toast__icon';
  icon.textContent = ICONS[type];
  icon.ariaHidden = 'true';

  const content = document.createElement('div');

  content.className = 'toast__content';

  const titleEl = document.createElement('div');

  titleEl.className = 'toast__title';
  titleEl.textContent = title ?? DEFAULT_TITLES[type];

  const messageEl = document.createElement('div');

  messageEl.className = 'toast__message';
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

    toast.classList.add('toast--hiding');

    const remove = (): void => toast.remove();

    toast.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, EXIT_FALLBACK_MS);
  };

  window.setTimeout(dismiss, VISIBLE_MS);
}
