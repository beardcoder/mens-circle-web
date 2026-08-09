/**
 * Ambient loop parking.
 *
 * The decorative breathing — hero rings, section glows, the drifting
 * ornaments — is all `animation: … infinite`. An infinite animation keeps
 * ticking wherever it lives: the compositor advances it, and the layer it
 * was promoted onto stays resident, even when its section is thousands of
 * pixels outside the viewport. A long page runs a dozen or more of them at
 * once, which is exactly the budget a scroll needs.
 *
 * So each `<section>` is watched, and whatever loops inside it are parked
 * with `animation-play-state: paused` while it is off-screen (the rule
 * lives in `utilities/_motion.css`). The margin below un-parks a section
 * well before it can be seen, so nothing ever resumes in view — including
 * the view-timeline ornaments, which re-derive their progress from the
 * timeline the moment they start again.
 *
 * Sections carrying `[data-motion-essential]` — the breathing exercise,
 * where the animation *is* the content — are never parked.
 */

const PAUSED_CLASS = 'is-ambient-paused';

/** Un-park this far outside the viewport, in each block direction. */
const ROOT_MARGIN = '50% 0px';

/**
 * Watch every section and park its ambient loops while it is off-screen.
 * Returns a cleanup function. No-op under reduced motion, where the loops
 * are already capped to a single iteration.
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

  // Server islands (the testimonials block is `server:defer`) swap their
  // section in after load — pick those up too.
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
