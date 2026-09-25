/** Site header — mobile panel and in-page anchor scrolling. */

import { prefersReducedMotion } from './helpers';

/** Offset anchored scrolling must clear below the fixed header. */
const headerOffset = (): number =>
  Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-clearance'), 10) || 92;

/** A link's fragment when it targets the current page, else `null`. */
const samePageHash = (link: HTMLAnchorElement): string | null => {
  const url = new URL(link.href, location.href);
  const samePage = url.origin === location.origin && url.pathname === location.pathname;
  return samePage && url.hash.length > 1 ? url.hash : null;
};

const scrollToAnchor = (hash: string): boolean => {
  const id = decodeURIComponent(hash.slice(1));
  const target = document.getElementById(id);
  if (!target) return false;

  window.scrollTo({
    top: Math.max(target.getBoundingClientRect().top + window.scrollY - headerOffset(), 0),
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
  });
  history.pushState(null, '', `#${id}`);
  return true;
};

export function initSiteHeader(): void {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  if (!nav || !toggle) return;

  const [top, mid, bottom] = toggle.querySelectorAll<HTMLElement>('.nav-toggle__bar');
  let isOpen = false;
  let scrollPosition = 0;

  const render = (): void => {
    toggle.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Menü schließen' : 'Menü öffnen');
    nav.classList.toggle('is-open', isOpen);
    document.body.classList.toggle('nav-open', isOpen);
    document.body.style.top = isOpen ? `-${scrollPosition}px` : '';

    const duration = prefersReducedMotion() ? '0ms' : '180ms';
    for (const bar of [top, mid, bottom]) bar.style.transition = `transform ${duration} ease, opacity ${duration} ease`;
    top.style.transform = isOpen ? 'translateY(6.5px) rotate(45deg)' : '';
    bottom.style.transform = isOpen ? 'translateY(-6.5px) rotate(-45deg)' : '';
    mid.style.opacity = isOpen ? '0' : '1';
  };

  const open = (): void => {
    scrollPosition = window.scrollY;
    isOpen = true;
    render();
  };

  /** With a `targetHash`, scroll there once the body lock lifts instead of
   *  restoring the pre-open position. */
  const close = (targetHash: string | null = null): void => {
    if (!isOpen) return;
    isOpen = false;
    render();
    if (targetHash === null || !scrollToAnchor(targetHash)) {
      window.scrollTo({ top: scrollPosition, behavior: 'instant' });
    }
  };

  toggle.addEventListener('click', () => (isOpen ? close() : open()));

  for (const link of document.querySelectorAll<HTMLAnchorElement>('#header a[data-nav-link]')) {
    link.addEventListener('click', (event) => {
      const hash = samePageHash(link);
      if (hash === null) return close();

      // Own the scroll so the header is cleared and closing does not snap back.
      event.preventDefault();
      if (isOpen) close(hash);
      else scrollToAnchor(hash);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  // Widening past the panel breakpoint while open would leave the body locked
  // with no visible panel.
  matchMedia('(width > 860px)').addEventListener('change', (event) => {
    if (event.matches) close();
  });

  render();
}
