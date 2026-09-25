/** Shared plumbing for the admin `<script>` blocks. */

export type AdminToastKind = 'ok' | 'err';

declare global {
  interface Window {
    adminToast?: (kind: AdminToastKind, text: string) => void;
  }
}

/** AdminLayout defines the toast once and it survives the swaps, so it may
 *  legitimately be absent for a moment. */
export const adminToast = (kind: AdminToastKind, text: string): void => window.adminToast?.(kind, text);

/** What an Astro action resolves to, narrowed by `ok()` below. */
type ActionResult<T> = { data: T; error: undefined } | { data: undefined; error: { message: string } };

/** Report an action's error and say whether the caller may go on. */
export function ok<T>(result: ActionResult<T>): result is { data: T; error: undefined } {
  if (!result.error) return true;
  adminToast('err', result.error.message);
  return false;
}

/** Run `setup` against the first `selector` match on every navigation, at most once per element. */
export function bindOnce<T extends HTMLElement>(selector: string, setup: (element: T) => void): void {
  const bind = (): void => {
    const element = document.querySelector<T>(selector);
    if (!element || element.dataset.bound) return;
    element.dataset.bound = '1';
    setup(element);
  };

  document.addEventListener('astro:page-load', bind);
}
