/**
 * Theme manager — two axes on <html>, persisted across visits:
 *   • `data-theme`  "cool" or absent (the warm default): the palette
 *   • `data-mode`   "light" | "dark" or absent (follow the OS)
 * Layout.astro applies both before first paint; this keeps the buttons in sync.
 */

type Mode = 'light' | 'dark';

const STORAGE_KEY = 'mc-mode';
const STORAGE_THEME = 'mc-theme';

/** Mobile browser chrome colour per palette and resolved mode (the page's ground). */
const THEME_COLOR: Record<'warm' | 'cool', Record<Mode, string>> = {
  warm: { light: '#faf8f5', dark: '#0a0704' },
  cool: { light: '#f6f9f8', dark: '#050b0a' },
};

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

/** The explicit mode the user pinned, or `null` when following the OS. */
const storedMode = (): Mode | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
};

const resolvedMode = (): Mode => storedMode() ?? (darkQuery.matches ? 'dark' : 'light');

/** Rendered twice (bar + menu) with CSS picking one; both stay in sync. */
const buttons = (): NodeListOf<HTMLButtonElement> => document.querySelectorAll('[data-mode-toggle]');
const paletteButtons = (): NodeListOf<HTMLButtonElement> => document.querySelectorAll('[data-theme-toggle]');

const palette = (): 'warm' | 'cool' =>
  document.documentElement.getAttribute('data-theme') === 'cool' ? 'cool' : 'warm';

/** Push the current mode onto <html>, the meta tag and the buttons. */
function apply(): void {
  const root = document.documentElement;
  const stored = storedMode();
  const resolved = resolvedMode();

  root.setAttribute('data-mode-resolved', resolved);
  if (stored) root.setAttribute('data-mode', stored);
  else root.removeAttribute('data-mode');

  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[palette()][resolved]);
  for (const btn of buttons()) btn.setAttribute('aria-pressed', String(resolved === 'dark'));
  for (const btn of paletteButtons()) btn.setAttribute('aria-pressed', String(palette() === 'cool'));
}

export function initTheme(): void {
  apply();

  for (const btn of buttons()) {
    btn.addEventListener('click', () => {
      try {
        localStorage.setItem(STORAGE_KEY, resolvedMode() === 'dark' ? 'light' : 'dark');
      } catch {
        // Storage unavailable (private mode) — the choice just will not persist.
      }
      apply();
    });
  }

  for (const btn of paletteButtons()) {
    btn.addEventListener('click', () => {
      const next = palette() === 'cool' ? 'warm' : 'cool';
      document.documentElement.toggleAttribute('data-theme', false);
      if (next === 'cool') document.documentElement.setAttribute('data-theme', 'cool');
      try {
        localStorage.setItem(STORAGE_THEME, next);
      } catch {
        // Storage unavailable (private mode) — the choice just will not persist.
      }
      apply();
    });
  }

  darkQuery.addEventListener('change', () => {
    if (storedMode() === null) apply();
  });
}
