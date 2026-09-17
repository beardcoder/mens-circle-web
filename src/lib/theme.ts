/**
 * Theme manager — light/dark, persisted across visits.
 *
 *   • `data-mode`          absent (follow OS) | "light" | "dark"
 *   • `data-mode-resolved` the mode actually in effect, mirrored for the icons
 *
 * The layout's inline boot script sets both attributes before first paint so
 * nothing flashes; this re-syncs on load, wires the button, and follows the OS
 * while no mode is pinned.
 */

export type Mode = 'light' | 'dark';

const STORAGE_MODE = 'mc-mode';

/** Mobile browser chrome colour per resolved mode (matches --bg-primary). */
const THEME_COLOR: Record<Mode, string> = {
  light: '#f3f0e9',
  dark: '#1c1e1b',
};

const prefersDark = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode) — the choice just will not persist.
  }
};

/** The explicit mode the user pinned, or `null` when following the OS. */
const getStoredMode = (): Mode | null => {
  const raw = readStored(STORAGE_MODE);

  return raw === 'light' || raw === 'dark' ? raw : null;
};

/** The mode actually in effect: explicit choice, else OS preference. */
const resolveMode = (): Mode => getStoredMode() ?? (prefersDark() ? 'dark' : 'light');

/** Point the mobile `theme-color` meta at the resolved mode. */
const syncThemeColor = (resolved: Mode): void => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  if (meta) meta.content = THEME_COLOR[resolved];
};

/** Push the current mode onto <html> and the meta tag. */
const apply = (): void => {
  const root = document.documentElement;
  const stored = getStoredMode();
  const resolved = resolveMode();

  root.setAttribute('data-mode-resolved', resolved);

  if (stored) root.setAttribute('data-mode', stored);
  else root.removeAttribute('data-mode');

  syncThemeColor(resolved);
};

/** Returns a cleanup; no-op when the switch isn't on the page. */
export function initTheme(): () => void {
  const teardown: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, handler: EventListener): void => {
    target.addEventListener(type, handler);
    teardown.push(() => target.removeEventListener(type, handler));
  };

  apply();

  // Rendered twice (bar + nav panel) with CSS picking one. Wire both so the
  // hidden copy is never stale when it takes over.
  const modeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode-toggle]'));

  const syncButtons = (): void => {
    const pressed = String(resolveMode() === 'dark');

    for (const btn of modeBtns) btn.setAttribute('aria-pressed', pressed);
  };

  syncButtons();

  for (const btn of modeBtns) {
    listen(btn, 'click', () => {
      writeStored(STORAGE_MODE, resolveMode() === 'dark' ? 'light' : 'dark');
      apply();
      syncButtons();
    });
  }

  if (typeof matchMedia === 'function') {
    const mq = matchMedia('(prefers-color-scheme: dark)');

    listen(mq, 'change', () => {
      if (getStoredMode() !== null) return;
      apply();
      syncButtons();
    });
  }

  return (): void => {
    for (const off of teardown) off();
  };
}
