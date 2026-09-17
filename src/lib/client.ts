/**
 * Client entry — wires up header, theme and scroll reveals once the DOM is
 * ready. Each initialiser is isolated so one failure never blocks the others.
 */

import { initAmbient } from './ambient';
import { initMotion } from './motion';
import { initSiteHeader } from './site-header';
import { initTheme } from './theme';

/**
 * `onFailure` is the recovery for an initialiser whose absence would otherwise
 * be visible: the reveals are hidden by CSS until they animate in, so a failed
 * initMotion has to drop the hidden state rather than wait out the layout's
 * fallback timer. Ambient parking is an optimisation and needs none.
 */
const INITIALISERS: { name: string; run: () => void; onFailure?: () => void }[] = [
  { name: 'initTheme', run: initTheme },
  { name: 'initSiteHeader', run: initSiteHeader },
  {
    name: 'initMotion',
    run: initMotion,
    onFailure: () => document.documentElement.classList.remove('motion-ready'),
  },
  { name: 'initAmbient', run: initAmbient },
];

let initialised = false;

function init(): void {
  if (initialised) return;
  initialised = true;

  for (const { name, run, onFailure } of INITIALISERS) {
    try {
      run();
    } catch (error) {
      onFailure?.();
      // eslint-disable-next-line no-console
      console.error(`[client] ${name} failed:`, error);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
