/**
 * Client entry — wires up header, theme and scroll reveals once the DOM is
 * ready. Each initialiser is isolated in try/catch so one failure never
 * blocks the others.
 */

import { initMotion } from './motion';
import { initSiteHeader } from './site-header';
import { initTheme } from './theme';

let initialised = false;

function init(): void {
  if (initialised) return;
  initialised = true;

  try {
    initTheme();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[client] initTheme failed:', error);
  }

  try {
    initSiteHeader();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[client] initSiteHeader failed:', error);
  }

  try {
    initMotion();
  } catch (error) {
    // Reveals are hidden by CSS until they animate in, so a failure here would
    // otherwise leave the page blank. Drop the hidden state immediately rather
    // than waiting out the layout's fallback timer.
    document.documentElement.classList.remove('motion-ready');
    // eslint-disable-next-line no-console
    console.error('[client] initMotion failed:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
