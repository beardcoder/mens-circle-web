/**
 * Scroll-triggered reveals. The hidden start state lives in CSS behind
 * `.motion-ready`, so without JS or under reduced motion everything stays
 * visible.
 *
 * Markup:
 *   data-reveal[="up"|"fade"]      a rise (default) or a plain cross-fade
 *   data-reveal-group[="55"]       stagger direct children, ms between them
 */

declare global {
  interface Window {
    /** Timer id parked on `window` by the layout's inline boot script. */
    __mcMotionFallback?: ReturnType<typeof setTimeout>;
  }
}

export function initMotion(): void {
  // Reveals are handled from here on, so the layout's dead-man's switch can stand down.
  clearTimeout(window.__mcMotionFallback);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Phones get shorter travel and quicker beats.
  const mobile = matchMedia('(width < 640px)').matches;
  const shift = mobile ? '0.4rem' : '0.6rem';
  const duration = mobile ? 300 : 360;

  const delays = new Map<Element, number>();
  for (const group of document.querySelectorAll<HTMLElement>('[data-reveal-group]')) {
    const parsed = Number(group.dataset.revealGroup);
    const step = Number.isFinite(parsed) && parsed >= 0 ? parsed : mobile ? 45 : 55;
    group.querySelectorAll(':scope > [data-reveal]').forEach((child, index) => delays.set(child, index * step));
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        observer.unobserve(target);
        // Composited properties only — nothing here reflows.
        const keyframes =
          (target as HTMLElement).dataset.reveal === 'fade'
            ? { opacity: [0, 1] }
            : { opacity: [0, 1], transform: [`translateY(${shift})`, 'none'] };
        target.animate(keyframes, {
          duration,
          delay: delays.get(target) ?? 0,
          easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
          fill: 'both',
        });
      }
    },
    // Fire slightly before full visibility, so the entrance reads as the eye arrives.
    { rootMargin: '0px 0px -12% 0px' },
  );

  for (const el of document.querySelectorAll('[data-reveal]')) observer.observe(el);
}
