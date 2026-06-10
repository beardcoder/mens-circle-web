/**
 * Site Header — navigation with a breathing, circle-reveal menu.
 *
 * The mobile menu is the signature surface. Tapping the toggle *breathes*
 * a full-screen earth panel open: a `clip-path` circle expands from the
 * button itself (Motion drives the radius), the concentric rings behind
 * the links pulse, and the links rise on a calm stagger. Closing inhales
 * the circle back down to the button.
 *
 * Every *transition* (open / close / link cascade / the toggle morphing
 * into an X) is driven by Motion Mini's `animate()` — WAAPI under the
 * hood, so we get JS-precise easing, clean interruption when the user
 * taps mid-animation, and a `finished` promise to drop `will-change` the
 * instant a move settles. The endless, ambient "breathing" (rings, the
 * idle toggle ring) lives in CSS so it costs nothing here and pauses
 * itself under reduced motion.
 *
 * This is a vanilla initialiser operating on the Astro-rendered DOM. It
 * wires every listener and returns a cleanup function that removes them
 * and stops any in-flight panel animation.
 */

import { animate } from 'motion/mini';
import { prefersReducedMotion } from './helpers';

const SCROLL_THRESHOLD_PX = 48;
const FALLBACK_HEADER_OFFSET_PX = 120;

/** Cubic-bézier easings, mirrored from `_variables.css`. `animate()` wants
 *  the four control points as a tuple. */
const EASE_EMPHASISED: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_SETTLE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_INHALE: [number, number, number, number] = [0.7, 0, 0.84, 0];

type Controls = ReturnType<typeof animate>;

/**
 * Offset (px) that anchored scrolling must clear below the fixed header,
 * read from the `--header-clearance` custom property.
 */
const headerOffset = (): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--header-clearance'
  );
  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) ? parsed : FALLBACK_HEADER_OFFSET_PX;
};

/**
 * The fragment of a link that targets an anchor on the *current* page, or
 * `null` when it navigates elsewhere (other origin/path, new tab, or no
 * fragment).
 */
const samePageHash = (link: HTMLAnchorElement): string | null => {
  if (link.target && link.target !== '_self') return null;

  let url: URL;

  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;
  if (url.pathname !== window.location.pathname) return null;
  if (url.hash === '' || url.hash === '#') return null;

  return url.hash;
};

/**
 * Radius a circle centred at (`ox`, `oy`) needs to cover the whole
 * viewport — the distance to the farthest corner.
 */
const coverRadius = (ox: number, oy: number): number => {
  const w = window.innerWidth;
  const h = window.innerHeight;

  return Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
};

/**
 * Wire the site header. Returns a cleanup function that removes every
 * listener and stops any in-flight panel animation. No-op (returns a
 * no-op cleanup) if the required DOM is missing.
 */
export function initSiteHeader(): () => void {
  const root = document.querySelector<HTMLElement>(
    'header.header#header[data-lume="site-header"]'
  );

  if (!root) return () => {};

  const nav = root.querySelector<HTMLElement>('[data-lume-part="nav"]');
  const toggle = root.querySelector<HTMLButtonElement>(
    '[data-lume-part="toggle"]'
  );

  if (!nav || !toggle) return () => {};

  const navLinks = Array.from(
    root.querySelectorAll<HTMLAnchorElement>('[data-lume-part="nav-link"]')
  );
  const heroEl = document.querySelector<HTMLElement>('.hero');

  const bars = Array.from(
    toggle.querySelectorAll<HTMLElement>('.nav-toggle__bar')
  );

  // Everything that cascades into / out of the open panel.
  const revealItems = [
    ...Array.from(nav.querySelectorAll<HTMLElement>('.nav__item')),
    ...Array.from(nav.querySelectorAll<HTMLElement>('.nav__meta')),
  ];

  // Track every binding so the returned cleanup can detach them all.
  const teardown: Array<() => void> = [];
  const listen = <K extends keyof DocumentEventMap>(
    target: EventTarget,
    type: K | string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions
  ): void => {
    target.addEventListener(type, handler, options);
    teardown.push(() => target.removeEventListener(type, handler, options));
  };

  let isOpen = false;
  let scrollPosition = 0;
  let panelAnim: Controls | null = null;

  // ─── In-page anchor scrolling ──────────────────────────────────────
  const scrollToAnchor = (hash: string): boolean => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    const target = id === '' ? null : document.getElementById(id);

    if (target === null) return false;

    const top =
      target.getBoundingClientRect().top + window.scrollY - headerOffset();

    window.scrollTo({
      top: Math.max(top, 0),
      left: 0,
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    });

    history.pushState(null, '', `#${id}`);

    return true;
  };

  // ─── Toggle ⇄ X morph ──────────────────────────────────────────────
  const renderToggle = (open: boolean): void => {
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');

    const [top, mid, bottom] = bars;

    if (!top || !mid || !bottom) return;

    if (prefersReducedMotion()) {
      const x = open ? '1' : '';

      top.style.transform = open ? 'translateY(8px) rotate(45deg)' : '';
      bottom.style.transform = open ? 'translateY(-8px) rotate(-45deg)' : '';
      mid.style.opacity = x;

      return;
    }

    const ease = open ? EASE_EMPHASISED : EASE_INHALE;

    animate(
      top,
      {
        transform: open
          ? 'translateY(8px) rotate(45deg)'
          : 'translateY(0px) rotate(0deg)',
      },
      { duration: 0.42, ease }
    );
    animate(
      mid,
      { opacity: open ? 0 : 1, transform: open ? 'scaleX(0.3)' : 'scaleX(1)' },
      { duration: open ? 0.22 : 0.34, ease }
    );
    animate(
      bottom,
      {
        transform: open
          ? 'translateY(-8px) rotate(-45deg)'
          : 'translateY(0px) rotate(0deg)',
      },
      { duration: 0.42, ease }
    );
  };

  // ─── Link cascade ──────────────────────────────────────────────────
  const cascadeLinks = (show: boolean): void => {
    if (prefersReducedMotion()) {
      for (const el of revealItems) {
        el.style.opacity = show ? '1' : '0';
        el.style.transform = '';
      }

      return;
    }

    revealItems.forEach((el, index) => {
      if (show) {
        el.style.willChange = 'transform, opacity';

        const controls = animate(
          el,
          {
            opacity: [0, 1],
            transform: ['translateY(28px)', 'translateY(0px)'],
          },
          { duration: 0.62, delay: 0.14 + index * 0.06, ease: EASE_SETTLE }
        );

        controls.finished
          .then(() => (el.style.willChange = ''))
          .catch(() => (el.style.willChange = ''));
      } else {
        animate(
          el,
          { opacity: 0, transform: 'translateY(18px)' },
          { duration: 0.26, ease: EASE_INHALE }
        );
      }
    });
  };

  // ─── Open / close ──────────────────────────────────────────────────
  const openMenu = (): void => {
    if (isOpen) return;
    isOpen = true;

    scrollPosition = window.scrollY;
    document.body.style.top = `-${scrollPosition}px`;
    document.body.classList.add('nav-open');
    renderToggle(true);

    const rect = toggle.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;

    if (prefersReducedMotion()) {
      nav.style.clipPath = 'none';
      nav.classList.add('is-open');
      cascadeLinks(true);

      return;
    }

    const from = `circle(0px at ${ox}px ${oy}px)`;
    const to = `circle(${coverRadius(ox, oy)}px at ${ox}px ${oy}px)`;

    // Set the closed clip synchronously, *then* reveal — so nothing flashes
    // between the panel becoming visible and Motion taking over the radius.
    nav.style.clipPath = from;
    nav.classList.add('is-open');
    nav.style.willChange = 'clip-path';

    panelAnim?.stop();
    panelAnim = animate(
      nav,
      { clipPath: [from, to] },
      {
        duration: 0.72,
        ease: EASE_EMPHASISED,
      }
    );
    panelAnim.finished
      .then(() => (nav.style.willChange = ''))
      .catch(() => (nav.style.willChange = ''));

    cascadeLinks(true);
  };

  /**
   * Inhale the circle back to the toggle. When `targetHash` points at an
   * in-page anchor, scroll there once the body lock is released instead of
   * restoring the pre-open position.
   */
  const closeMenu = (targetHash: string | null = null): void => {
    if (!isOpen) return;
    isOpen = false;

    renderToggle(false);
    cascadeLinks(false);

    const finalize = (): void => {
      nav.classList.remove('is-open');
      nav.style.clipPath = '';
      nav.style.willChange = '';
      document.body.classList.remove('nav-open');
      document.body.style.top = '';

      if (targetHash !== null && scrollToAnchor(targetHash)) return;

      window.scrollTo({ top: scrollPosition, left: 0, behavior: 'instant' });
    };

    if (prefersReducedMotion()) {
      finalize();

      return;
    }

    const rect = toggle.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;
    const from = `circle(${coverRadius(ox, oy)}px at ${ox}px ${oy}px)`;
    const to = `circle(0px at ${ox}px ${oy}px)`;

    nav.style.willChange = 'clip-path';
    panelAnim?.stop();
    panelAnim = animate(
      nav,
      { clipPath: [from, to] },
      {
        duration: 0.5,
        delay: 0.05,
        ease: EASE_INHALE,
      }
    );
    panelAnim.finished.then(finalize).catch(finalize);
  };

  // ─── Scroll state (header background fallback + hero tone) ──────────
  document.body.classList.toggle('has-hero', !!heroEl);
  document.body.classList.toggle('no-hero', !heroEl);

  let isScrolled = window.scrollY > SCROLL_THRESHOLD_PX || !heroEl;
  const renderScroll = (): void => {
    root.classList.toggle('is-scrolled', isScrolled);
  };

  listen(
    window,
    'scroll',
    () => {
      const next = window.scrollY > SCROLL_THRESHOLD_PX || !heroEl;

      if (next === isScrolled) return;
      isScrolled = next;
      renderScroll();
    },
    { passive: true }
  );

  // ─── Interactions ──────────────────────────────────────────────────
  listen(toggle, 'click', () => {
    if (isOpen) closeMenu();
    else openMenu();
  });

  for (const link of navLinks) {
    listen(link, 'click', (event) => {
      const hash = samePageHash(link);

      // Plain links navigate normally; just dismiss an open menu.
      if (hash === null) {
        closeMenu();

        return;
      }

      // Own the scroll for in-page anchors so the fixed header is cleared
      // and the close animation doesn't snap us back to the saved position.
      (event as MouseEvent).preventDefault();

      if (isOpen) closeMenu(hash);
      else scrollToAnchor(hash);
    });
  }

  listen(document, 'keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape' && isOpen) closeMenu();
  });

  // ─── Initial paint ─────────────────────────────────────────────────
  renderScroll();
  renderToggle(false);

  return (): void => {
    panelAnim?.stop();

    for (const off of teardown) off();
  };
}
