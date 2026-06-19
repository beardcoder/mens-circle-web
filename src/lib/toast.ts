/**
 * Toast Notifications
 *
 * Thin DOM helper. All entry/exit motion lives in CSS via `@starting-style`
 * and `.toast--hiding` — JS just appends the element and removes it after
 * the lifetime expires.
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
  warning: '!',
};

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'Erfolg',
  error: 'Fehler',
  info: 'Information',
  warning: 'Warnung',
};

const VISIBLE_MS = 5000;
const EXIT_FALLBACK_MS = 400;

function buildToast(type: ToastType, message: string, title?: string): HTMLDivElement {
  const toast = document.createElement('div');

  toast.className = `toast toast--${type}`;
  toast.role = 'alert';
  toast.ariaLive = 'polite';

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
