/** Theme manager — light/dark, persisted across visits. */

type Mode = 'light' | 'dark';

const STORAGE_KEY = 'mc-mode';

/** Mobile browser chrome colour per resolved mode (matches --bg-primary). */
const THEME_COLOR: Record<Mode, string> = { light: '#f3f0e9', dark: '#1c1e1b' };

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

/** Rendered twice (bar + nav panel) with CSS picking one; both stay in sync. */
const buttons = (): NodeListOf<HTMLButtonElement> => document.querySelectorAll('[data-mode-toggle]');

/** Push the current mode onto <html>, the meta tag and the buttons. */
function apply(): void {
  const root = document.documentElement;
  const stored = storedMode();
  const resolved = resolvedMode();

  root.setAttribute('data-mode-resolved', resolved);
  if (stored) root.setAttribute('data-mode', stored);
  else root.removeAttribute('data-mode');

  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
  for (const btn of buttons()) btn.setAttribute('aria-pressed', String(resolved === 'dark'));
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

  darkQuery.addEventListener('change', () => {
    if (storedMode() === null) apply();
  });
}
