/**
 * Ambient loop parking. An infinite animation keeps ticking and keeps its layer
 * resident even far outside the viewport, so each `<section>` is watched and its
 * loops paused while off-screen (the rule lives in `utilities/_motion.css`). The
 * margin un-parks well before the section is visible, so nothing resumes in
 * view. Sections carrying `[data-motion-essential]` are never parked.
 */

const PAUSED_CLASS = 'is-ambient-paused';

/** Un-park this far outside the viewport, in each block direction. */
const ROOT_MARGIN = '50% 0px';

/** Returns a cleanup. No-op under reduced motion, where the loops run once. */
export function initAmbient(): () => void {
  if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle(PAUSED_CLASS, !entry.isIntersecting);
      }
    },
    { rootMargin: ROOT_MARGIN },
  );

  const watched = new WeakSet<Element>();

  const watch = (root: ParentNode): void => {
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section'));

    if (root instanceof HTMLElement && root.matches('section')) sections.unshift(root);

    for (const section of sections) {
      if (watched.has(section)) continue;
      if (section.querySelector('[data-motion-essential]') !== null) continue;

      watched.add(section);
      observer.observe(section);
    }
  };

  watch(document.body);

  // Every section is server-rendered; hydration adds none and navigation is
  // native, so one pass is enough.
  return (): void => {
    observer.disconnect();
  };
}
