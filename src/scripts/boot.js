/* Inlined in the <head> of every public page (Layout.astro, hashed for the CSP). */
// Before the first paint: the colour mode, so nothing flashes. `mc-appearance` holds
// a pinned choice from ModeToggle; without one the page follows the system.
(() => {
  const root = document.documentElement;

  try {
    const stored = localStorage.getItem('mc-appearance');
    const mode = stored === 'light' || stored === 'dark' ? stored : null;
    const resolved = mode || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    root.setAttribute('data-mode-resolved', resolved);

    if (mode) root.setAttribute('data-mode', mode);
  } catch {
    /* localStorage or matchMedia unavailable — fall back to CSS defaults. */
  }
})();
