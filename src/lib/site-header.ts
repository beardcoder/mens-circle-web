/**
 * Site header — navigation, mobile panel, in-page anchor scrolling.
 *
 * The panel used to expand as a `clip-path` circle out of the toggle button,
 * with the links rising on a stagger and an inhale on close. It is now a plain
 * cross-fade owned by CSS: opening a menu is not an event worth animating, and
 * the whole thing is ~120 lines lighter and has no in-flight animation to
 * interrupt.
 *
 * What this module still owns, because CSS cannot: the open/closed state, the
 * body scroll lock (and restoring the scroll position afterwards), the
 * hamburger⇄X morph, Escape-to-close, and anchor scrolling that clears the
 * fixed header.
 *
 * Vanilla initialiser over the Astro-rendered DOM. Returns a cleanup that
 * detaches every listener.
 */

import { prefersReducedMotion } from './helpers';

const FALLBACK_HEADER_OFFSET_PX = 92;

/** Offset anchored scrolling must clear below the fixed header. */
const headerOffset = (): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-clearance');
  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) ? parsed : FALLBACK_HEADER_OFFSET_PX;
};

/** A link's fragment when it targets the current page, else `null`. */
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

/** Wire the header. Returns a cleanup; no-op when the DOM isn't there. */
export function initSiteHeader(): () => void {
  const root = document.querySelector<HTMLElement>('header.header#header[data-lume="site-header"]');

  if (!root) return () => {};

  const nav = root.querySelector<HTMLElement>('[data-lume-part="nav"]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-lume-part="toggle"]');

  if (!nav || !toggle) return () => {};

  const navLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-lume-part="nav-link"]'));
  const bars = Array.from(toggle.querySelectorAll<HTMLElement>('.nav-toggle__bar'));

  // Track every binding so the returned cleanup can detach them all.
  const teardown: Array<() => void> = [];
  const listen = <K extends keyof DocumentEventMap>(
    target: EventTarget,
    type: K | string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, handler, options);
    teardown.push(() => target.removeEventListener(type, handler, options));
  };

  let isOpen = false;
  let scrollPosition = 0;

  // ─── In-page anchor scrolling ──────────────────────────────────────
  const scrollToAnchor = (hash: string): boolean => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    const target = id === '' ? null : document.getElementById(id);

    if (target === null) return false;

    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset();

    window.scrollTo({
      top: Math.max(top, 0),
      left: 0,
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    });

    history.pushState(null, '', `#${id}`);

    return true;
  };

  // ─── Toggle ⇄ X morph. Transforms only, so it composites. ──────────
  const renderToggle = (open: boolean): void => {
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');

    const [top, mid, bottom] = bars;

    if (!top || !mid || !bottom) return;

    const duration = prefersReducedMotion() ? '0ms' : '180ms';

    for (const bar of bars) bar.style.transition = `transform ${duration} ease, opacity ${duration} ease`;

    top.style.transform = open ? 'translateY(6.5px) rotate(45deg)' : '';
    bottom.style.transform = open ? 'translateY(-6.5px) rotate(-45deg)' : '';
    mid.style.opacity = open ? '0' : '1';
  };

  // ─── Open / close ──────────────────────────────────────────────────
  const openMenu = (): void => {
    if (isOpen) return;
    isOpen = true;

    scrollPosition = window.scrollY;
    document.body.style.top = `-${scrollPosition}px`;
    document.body.classList.add('nav-open');
    nav.classList.add('is-open');
    renderToggle(true);
  };

  /**
   * With a `targetHash`, scroll there once the body lock lifts instead of
   * restoring the pre-open position.
   */
  const closeMenu = (targetHash: string | null = null): void => {
    if (!isOpen) return;
    isOpen = false;

    nav.classList.remove('is-open');
    renderToggle(false);
    document.body.classList.remove('nav-open');
    document.body.style.top = '';

    if (targetHash !== null && scrollToAnchor(targetHash)) return;

    window.scrollTo({ top: scrollPosition, left: 0, behavior: 'instant' });
  };

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

      // Own the scroll so the header is cleared and closing the panel doesn't
      // snap back to the saved position.
      (event as MouseEvent).preventDefault();

      if (isOpen) closeMenu(hash);
      else scrollToAnchor(hash);
    });
  }

  listen(document, 'keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape' && isOpen) closeMenu();
  });

  // Widening past the panel breakpoint while it is open would otherwise leave
  // the body locked with no visible panel.
  if (typeof matchMedia === 'function') {
    const mq = matchMedia('(width > 860px)');

    listen(mq, 'change', () => {
      if (mq.matches && isOpen) closeMenu();
    });
  }

  // ─── Initial paint ─────────────────────────────────────────────────
  renderToggle(false);

  return (): void => {
    for (const off of teardown) off();
  };
}
