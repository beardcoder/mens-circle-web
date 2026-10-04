/** Pauses the breathing backgrounds while they are off screen — no work for what nobody sees. */

export function initBreath(): void {
  const fields = document.querySelectorAll<HTMLElement>('[data-breath]');
  if (fields.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        (target as HTMLElement).dataset.breath = isIntersecting ? 'running' : 'paused';
      }
    },
    { rootMargin: '10% 0px' },
  );

  for (const field of fields) observer.observe(field);
}
