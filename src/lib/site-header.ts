/** Site header — its tone over the home opening, the phone menu (a modal `<dialog>`) and the way back to the top. */

import { prefersReducedMotion } from './helpers';

/** A link's fragment when it targets the current page, else `null`. */
const samePageHash = (link: HTMLAnchorElement): string | null => {
  const url = new URL(link.href, location.href);
  const samePage = url.origin === location.origin && url.pathname === location.pathname;
  return samePage && url.hash.length > 1 ? url.hash : null;
};

/**
 * The corner button scrolls to the very top itself instead of leaving it to the
 * fragment: no `#top` left in the address bar, and the focus moves to the top so
 * keyboard users continue from there. Without JS the plain `#top` link still works.
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
 * Over the home opening (`[data-hero]`) the bar starts clear with light text and
 * turns to the page's paper once the page moves (`data-scrolled`, styled in
 * Header.astro). A script, not a scroll timeline, so every engine gets a readable bar.
 */
const initHeaderTone = (header: HTMLElement): void => {
  let frame = 0;
  const update = (): void => {
    frame = 0;
    header.toggleAttribute('data-scrolled', window.scrollY > 24);
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

/**
 * The phone menu. `showModal()` gives the focus trap, Escape and the return of
 * the focus to the menu button; a link to a place on this page closes the menu
 * first, then scrolls there (the CSS scroll padding clears the bar). It opens
 * and closes as a circle from the menu button.
 */
const initMenu = (menu: HTMLDialogElement): void => {
  for (const opener of document.querySelectorAll<HTMLButtonElement>('[data-nav-open]')) {
    opener.addEventListener('click', () => {
      // The menu opens as a circle from the button's centre (`--nav-origin` in Header.astro).
      const { left, top, width, height } = opener.getBoundingClientRect();
      menu.style.setProperty('--nav-origin', `${left + width / 2}px ${top + height / 2}px`);
      menu.showModal();
    });
  }
  menu.querySelector('[data-nav-close]')?.addEventListener('click', () => menu.close());

  for (const link of menu.querySelectorAll<HTMLAnchorElement>('a[data-nav-link]')) {
    link.addEventListener('click', (event) => {
      const hash = samePageHash(link);
      if (hash === null) return;
      event.preventDefault();
      menu.close();
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
      history.pushState(null, '', hash);
    });
  }
};

export function initSiteHeader(): void {
  initScrollTop();
  const header = document.getElementById('header');
  if (header) initHeaderTone(header);
  const menu = document.getElementById('nav');
  if (menu instanceof HTMLDialogElement) initMenu(menu);
}
