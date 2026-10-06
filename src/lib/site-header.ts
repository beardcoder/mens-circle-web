/** Site header — mobile panel and in-page anchor scrolling. */

import { prefersReducedMotion } from './helpers';

/** Offset anchored scrolling must clear below the fixed header. */
const headerOffset = (): number =>
  Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--spacing-clearance'), 10) || 92;

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
  const header = document.getElementById('header');
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  if (!header || !nav || !toggle) return;

  let isOpen = false;
  let scrollPosition = 0;

  const render = (): void => {
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Menü schließen' : 'Menü öffnen');
    // The header's `data-open` drives the panel, the toggle and the bar's button
    // (`group-data-[open]/header:` in Header.astro); the body's locks the page.
    header.toggleAttribute('data-open', isOpen);
    document.body.toggleAttribute('data-nav-open', isOpen);
    document.body.style.top = isOpen ? `-${scrollPosition}px` : '';
  };

  /** The panel opens as a circle from the toggle's centre (see `#nav` in Header.astro). */
  const setOrigin = (): void => {
    const button = toggle.getBoundingClientRect();
    const panel = nav.getBoundingClientRect();
    const x = button.left + button.width / 2 - panel.left;
    const y = button.top + button.height / 2 - panel.top;
    nav.style.setProperty('--nav-origin', `${x}px ${y}px`);
  };

  const open = (): void => {
    scrollPosition = window.scrollY;
    setOrigin();
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
  matchMedia('(width >= 56rem)').addEventListener('change', (event) => {
    if (event.matches) close();
  });

  render();
}
