/** Long participant voices open folded to a few lines; the button unfolds the full, unchanged text. */

const FOLDED = 'Vollständige Erfahrung lesen';
const OPEN = 'Weniger anzeigen';

const bind = (): void => {
  for (const figure of document.querySelectorAll<HTMLElement>('[data-quote][data-collapsible]')) {
    const toggle = figure.querySelector<HTMLButtonElement>('[data-quote-toggle]');

    if (!toggle || toggle.dataset.bound !== undefined) continue;

    toggle.dataset.bound = '';

    const render = (collapsed: boolean): void => {
      figure.toggleAttribute('data-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.textContent = collapsed ? FOLDED : OPEN;
    };

    toggle.hidden = false;
    render(true);
    toggle.addEventListener('click', () => render(!figure.hasAttribute('data-collapsed')));
  }
};

/** The voices arrive in a server island after this runs: bind again as islands land, until none is pending. */
export function initQuotes(): void {
  bind();
  const pending = (): boolean => document.querySelector('script[data-island-id]') !== null;

  if (!pending()) return;

  const observer = new MutationObserver(() => {
    bind();

    if (!pending()) observer.disconnect();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
