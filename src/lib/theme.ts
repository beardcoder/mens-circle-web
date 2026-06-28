/**
 * Theme manager — palette + light/dark, persisted across visits.
 *
 * Two independent axes live on the <html> element and in localStorage:
 *
 *   • Palette  — `data-theme`         : "warm" (default) | "cool"
 *   • Mode     — `data-mode`          : (absent → follow OS) | "light" | "dark"
 *   • Resolved — `data-mode-resolved` : "light" | "dark"  (mirror used for icons)
 *
 * The *resolved* mode is the mode actually in effect: the explicit choice
 * when one is stored, otherwise the OS preference. Only the resolved mode
 * drives the header icon swap and the mobile `theme-color`; the palette and
 * the color-scheme branch of every `light-dark()` token follow `data-theme`
 * and `data-mode` directly in CSS.
 *
 * The attributes are also set by an inline boot script in the layout head
 * (before first paint) so nothing flashes; this module re-syncs on load,
 * wires the header buttons, and keeps things live when the OS flips while
 * no explicit mode is pinned. Returns a cleanup that detaches everything.
 *
 * A *user* toggle cross-fades via the View Transitions API — the same
 * language the site already uses for page navigation — with the root swap
 * tuned in CSS (see `_view-transitions.css`, `[data-theme-transition]`).
 * It degrades to an instant swap without VT support or under reduced
 * motion. OS-driven flips apply instantly and never hijack with motion.
 */

import { prefersReducedMotion } from './helpers';

export type Palette = 'warm' | 'cool';
export type Mode = 'light' | 'dark';

/** `Document.startViewTransition` is not in the DOM lib yet — narrow locally. */
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<unknown> };
};

const STORAGE_THEME = 'mc-theme';
const STORAGE_MODE = 'mc-mode';

/** Mobile browser chrome color per palette × resolved mode (≈ --bg-primary). */
const THEME_COLOR: Record<Palette, Record<Mode, string>> = {
  warm: { light: '#faf8f4', dark: '#1d1712' },
  cool: { light: '#f4f8f7', dark: '#141a19' },
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
    // Storage unavailable (private mode / disabled) — choice just won't persist.
  }
};

/** The active palette: a stored "cool", else "warm". */
const getPalette = (): Palette => (readStored(STORAGE_THEME) === 'cool' ? 'cool' : 'warm');

/** The explicit mode the user pinned, or `null` when following the OS. */
const getStoredMode = (): Mode | null => {
  const raw = readStored(STORAGE_MODE);

  return raw === 'light' || raw === 'dark' ? raw : null;
};

/** The mode actually in effect: explicit choice, else OS preference. */
const resolveMode = (): Mode => getStoredMode() ?? (prefersDark() ? 'dark' : 'light');

/** Point the mobile `theme-color` meta at the active palette × resolved mode. */
const syncThemeColor = (palette: Palette, resolved: Mode): void => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  if (meta) meta.content = THEME_COLOR[palette][resolved];
};

/** Push the current palette/mode/resolved state onto <html> + the meta tag. */
const apply = (): void => {
  const root = document.documentElement;
  const palette = getPalette();
  const stored = getStoredMode();
  const resolved = resolveMode();

  root.setAttribute('data-theme', palette);
  root.setAttribute('data-mode-resolved', resolved);

  if (stored) root.setAttribute('data-mode', stored);
  else root.removeAttribute('data-mode');

  syncThemeColor(palette, resolved);
};

/**
 * Wire the header theme controls. Returns a cleanup function that removes
 * every listener. No-op cleanup if the switch isn't on the page.
 */
export function initTheme(): () => void {
  const teardown: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, handler: EventListener): void => {
    target.addEventListener(type, handler);
    teardown.push(() => target.removeEventListener(type, handler));
  };

  // Re-assert state on load (covers stored choices made before this ran).
  apply();

  const paletteBtn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  const modeBtn = document.querySelector<HTMLButtonElement>('[data-mode-toggle]');

  const syncButtons = (): void => {
    paletteBtn?.setAttribute('aria-pressed', String(getPalette() === 'cool'));
    modeBtn?.setAttribute('aria-pressed', String(resolveMode() === 'dark'));
  };

  syncButtons();

  /**
   * Persist a choice (`mutate`), then repaint the new theme. When the
   * browser supports it and motion is welcome, the repaint runs inside a
   * view transition so the page cross-fades instead of snapping.
   */
  const commit = (mutate: () => void): void => {
    mutate();

    const repaint = (): void => {
      apply();
      syncButtons();
    };

    const root = document.documentElement;
    const doc = document as ViewTransitionDocument;

    if (prefersReducedMotion() || typeof doc.startViewTransition !== 'function') {
      repaint();

      return;
    }

    root.setAttribute('data-theme-transition', '');
    const transition = doc.startViewTransition(repaint);
    const clear = (): void => root.removeAttribute('data-theme-transition');

    transition.finished.then(clear, clear);
  };

  if (paletteBtn) {
    listen(paletteBtn, 'click', () =>
      commit(() => writeStored(STORAGE_THEME, getPalette() === 'cool' ? 'warm' : 'cool')),
    );
  }

  if (modeBtn) {
    // Toggle relative to what's actually showing, then pin it explicitly.
    listen(modeBtn, 'click', () =>
      commit(() => writeStored(STORAGE_MODE, resolveMode() === 'dark' ? 'light' : 'dark')),
    );
  }

  // Keep the resolved mode live when the OS flips and nothing is pinned.
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
