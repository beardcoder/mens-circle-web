/** Site header — its tone over a dark opening, the full-screen menu, in-page anchor scrolling and the way back to the top. */

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

/**
 * The corner button scrolls to the very top itself instead of leaving it to the
 * fragment: no `#top` left in the address bar, no browser quirk with an empty
 * target, and the focus moves to the top so keyboard users continue from there.
 * Without JS the plain `#top` link still works.
 */
const initScrollTop = (): void => {
  const top = document.getElementById('top');
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-scroll-top]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
      top?.focus({ preventScroll: true });
    });
  }
};

/**
 * Over a dark opening (`[data-hero]`) the bar starts transparent with light text
 * and turns to glass with the page's text once the page moves (`data-scrolled`,
 * styled in Header.astro). A script, not a scroll timeline, so every engine gets
 * a readable bar.
 */
const initHeaderTone = (header: HTMLElement): void => {
  let frame = 0;
  const update = (): void => {
    frame = 0;
    header.toggleAttribute('data-scrolled', window.scrollY > 40);
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
};

export function initSiteHeader(): void {
  initScrollTop();

  const header = document.getElementById('header');
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  if (!header || !nav || !toggle) return;
  initHeaderTone(header);

  let isOpen = false;
  let scrollPosition = 0;

  const render = (): void => {
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Menü schließen' : 'Menü öffnen');
    // The header's `data-open` drives the menu, the toggle and the bar's tone
    // (`group-data-[open]/header:` in Header.astro); the body's locks the page.
    header.toggleAttribute('data-open', isOpen);
    document.body.toggleAttribute('data-nav-open', isOpen);
    document.body.style.top = isOpen ? `-${scrollPosition}px` : '';
  };

  /** The menu opens as a circle from the toggle's centre (see `#nav` in Header.astro). */
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

  render();
}
