/* Inlined in the <head> of every public page (Layout.astro, hashed for the CSP). */
// Before the first paint: how the page arrived, its motion and its mode, so nothing flashes.
(() => {
  const root = document.documentElement;

  /**
   * How the page arrived: reached again through the history (`return`), from
   * another page of the site (`next`), or opened (none). The Navigation API
   * knows; without it the navigation timing and the referrer tell.
   */
  const arrivalOf = () => {
    const activation = window.navigation?.activation;
    const entry = performance.getEntriesByType('navigation')[0];

    if (activation ? activation.navigationType === 'traverse' : entry?.type === 'back_forward') return 'return';

    const fromSite = activation
      ? Boolean(activation.from) && activation.navigationType !== 'reload'
      : entry?.type === 'navigate' && document.referrer.startsWith(`${location.origin}/`);

    return fromSite ? 'next' : '';
  };

  // A page reached from the site arrives composed, like an app's next screen, and
  // one reached again through the history stands as it was left: no opening,
  // nothing hidden in the first frame (`data-arrival`, global.css). The opening
  // plays when the site is opened.
  const arrival = arrivalOf();

  if (arrival) root.setAttribute('data-arrival', arrival);

  // Motion (components/Motion.astro) hides what it will move; if its script has
  // not started within three seconds, what waited fades in once and then stands.
  const startMotion = () => {
    if (arrival || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

    root.setAttribute('data-motion', '');
    setTimeout(() => {
      if (root.hasAttribute('data-motion-ready')) return;

      // Fade in what was waiting (global.css), rather than let it pop up at once.
      root.removeAttribute('data-motion');
      root.setAttribute('data-motion-failed', '');
    }, 3000);
  };

  try {
    startMotion();
  } catch {
    /* matchMedia unavailable — no motion. */
  }

  // Page transitions (global.css, "Page transitions") move like an app's stack:
  // forward from the right, back from the left. Only a script in the head hears
  // the page revealed in time to name the direction; a page left through its open
  // phone menu lets the menu fade over the next (`menu`). Arriving from the site,
  // the first frame waits until the page is parsed up to the footer: it is laid
  // out once before anything moves, instead of piece by piece while it slides in.
  let restored = false;

  if (arrival) {
    const expect = Object.assign(document.createElement('link'), { rel: 'expect', href: '#footer' });

    expect.setAttribute('blocking', 'render');
    document.head.append(expect);
  }

  /**
   * The frame that holds still: the bar, and an open menu on the way out. Named
   * only while a transition runs, on the elements themselves: a name makes its
   * element a backdrop root, and the bar keeps its blur only without one.
   */
  const frame = (on, menuOpen = false) => {
    document.getElementById('header')?.style.setProperty('view-transition-name', on ? 'site-header' : '');
    document.getElementById('nav')?.style.setProperty('view-transition-name', on && menuOpen ? 'nav-menu' : '');
  };

  /** Back through the history: the entry we arrived at lies before the one we left. */
  const isBack = () => {
    const now = window.navigation?.activation;

    if (!now?.from || !now.entry) return restored || arrival === 'return';

    return now.navigationType === 'traverse' && now.entry.index < now.from.index;
  };

  /** Read once: did the last page leave through its open menu? */
  const leftMenu = () => {
    try {
      const left = sessionStorage.getItem('mc-transition') === 'menu';

      sessionStorage.removeItem('mc-transition');

      return left;
    } catch {
      return false;
    }
  };

  /** A page restored with the menu it was left through comes back without it, at once. */
  const closeMenu = () => {
    const menu = document.getElementById('nav');

    if (!restored || !menu?.open) return;

    menu.style.transition = 'none';
    menu.close();
    requestAnimationFrame(() => requestAnimationFrame(() => menu.style.removeProperty('transition')));
  };

  addEventListener('pageswap', (event) => {
    if (!event.viewTransition) return;

    const viaMenu = document.getElementById('nav')?.open === true;

    frame(true, viaMenu);

    try {
      if (viaMenu) sessionStorage.setItem('mc-transition', 'menu');
    } catch {
      /* sessionStorage unavailable — the plain transition. */
    }
  });
  addEventListener('pageshow', (event) => {
    restored = event.persisted;
  });
  addEventListener('pagereveal', (event) => {
    const transition = event.viewTransition;
    const menu = leftMenu();

    closeMenu();
    frame(Boolean(transition));

    if (!transition) return;

    void transition.finished.then(() => frame(false));

    if (!transition.types) return;

    if (menu) transition.types.add('menu');

    transition.types.add(isBack() ? 'back' : 'forward');
  });

  try {
    // Earlier keys: the cool palette is gone, and the old day/night switch pinned a
    // mode for good. Everyone starts on Auto (the system) once; a choice made in the
    // picker is kept under the new key.
    localStorage.removeItem('mc-theme');
    localStorage.removeItem('mc-mode');
    const stored = localStorage.getItem('mc-appearance');
    const mode = stored === 'light' || stored === 'dark' ? stored : null;
    const resolved = mode || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    root.setAttribute('data-mode-resolved', resolved);

    if (mode) root.setAttribute('data-mode', mode);
  } catch {
    /* localStorage or matchMedia unavailable — fall back to CSS defaults. */
  }
})();
