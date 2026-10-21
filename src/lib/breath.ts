/** An optional breath rhythm, stopped when it leaves the screen or the tab hides. */
export function initBreath(): void {
  const guide = document.querySelector<HTMLElement>('[data-breath]');
  const toggle = guide?.querySelector<HTMLButtonElement>('[data-breath-toggle]');

  if (!guide || !toggle) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  const render = (running: boolean): void => {
    guide.toggleAttribute('data-running', running);
    toggle.setAttribute('aria-pressed', String(running));
    toggle.textContent = running ? 'Rhythmus stoppen' : 'Rhythmus starten';
  };

  toggle.hidden = false;
  toggle.addEventListener('click', () => render(!motion.matches && !guide.hasAttribute('data-running')));
  motion.addEventListener('change', () => render(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) render(false);
  });
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) render(false);
  }).observe(guide);
}
