/**
 * Day and night — `data-mode` on <html>, "light" | "dark" or absent (follow the
 * OS), persisted across visits. Layout.astro applies it before first paint; this
 * keeps the toggles and the browser chrome colour in sync.
 */

type Mode = 'light' | 'dark';

const STORAGE_KEY = 'mc-mode';

/** Mobile browser chrome colour per resolved mode (the page's ground). */
const THEME_COLOR: Record<Mode, string> = { light: '#f8f5ef', dark: '#1b1917' };

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

/** Rendered in the footer and the phone menu; all stay in sync. */
const toggles = (): NodeListOf<HTMLButtonElement> => document.querySelectorAll('[data-mode-toggle]');

/** Push the current mode onto <html>, the meta tag and the toggles. */
function apply(): void {
  const root = document.documentElement;
  const stored = storedMode();
  const resolved = resolvedMode();

  root.setAttribute('data-mode-resolved', resolved);

  if (stored) root.setAttribute('data-mode', stored);
  else root.removeAttribute('data-mode');

  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);

  for (const toggle of toggles()) toggle.setAttribute('aria-pressed', String(resolved === 'dark'));
}

export function initTheme(): void {
  apply();

  for (const toggle of toggles()) {
    toggle.addEventListener('click', () => {
      try {
        localStorage.setItem(STORAGE_KEY, resolvedMode() === 'dark' ? 'light' : 'dark');
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
