/**
 * Shared plumbing for the admin `<script>` blocks. They all bind to one element
 * after a view-transition swap and all report an action's failure the same way,
 * so both live here rather than five times over.
 */

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

/**
 * Report an action's error and say whether the caller may go on. A type guard
 * rather than a boolean helper, so `result.data` is known to be there in the
 * branch that uses it.
 */
export function ok<T>(result: ActionResult<T>): result is { data: T; error: undefined } {
  if (!result.error) return true;
  adminToast('err', result.error.message);
  return false;
}

/**
 * Run `setup` against the first `selector` match on every navigation, at most
 * once per element. `astro:page-load` fires on first load and after each
 * view-transition swap, where the element is a fresh node, so the guard is on
 * the node itself rather than on a module-level flag.
 */
export function bindOnce<T extends HTMLElement>(selector: string, setup: (element: T) => void): void {
  const bind = (): void => {
    const element = document.querySelector<T>(selector);
    if (!element || element.dataset.bound) return;
    element.dataset.bound = '1';
    setup(element);
  };

  document.addEventListener('astro:page-load', bind);
}
