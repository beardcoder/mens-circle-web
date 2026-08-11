/**
 * Ambient loop parking.
 *
 * The decorative breathing is all `animation: … infinite`, and an infinite
 * animation keeps ticking — and keeps its layer resident — even thousands of
 * pixels outside the viewport. A long page ran a dozen at once, spending the
 * budget the scroll needs.
 *
 * So each `<section>` is watched and its loops are paused while off-screen (the
 * rule lives in `utilities/_motion.css`). The margin un-parks well before the
 * section is visible, so nothing resumes in view — including the view-timeline
 * ornaments, which re-derive progress from the timeline when they restart.
 *
 * Sections carrying `[data-motion-essential]` are never parked.
 */

const PAUSED_CLASS = 'is-ambient-paused';

/** Un-park this far outside the viewport, in each block direction. */
const ROOT_MARGIN = '50% 0px';

/**
 * Watch every section and park its loops while off-screen. Returns a cleanup.
 * No-op under reduced motion, where the loops already run once.
 */
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

  // The testimonials block is `server:defer` — catch sections added after load.
  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement) watch(node);
      }
    }
  });

  mutations.observe(document.body, { childList: true, subtree: true });

  return (): void => {
    mutations.disconnect();
    observer.disconnect();
  };
}
