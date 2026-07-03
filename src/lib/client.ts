/**
 * Client entry — wires up header, theme and scroll reveals once the DOM is
 * ready. Each initialiser is isolated in try/catch so one failure never
 * blocks the others.
 */

import { initEventCtas } from './event-cta';
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
    // eslint-disable-next-line no-console
    console.error('[client] initMotion failed:', error);
  }

  // Runtime check on prerendered pages: event CTAs stay hidden unless an
  // upcoming event exists.
  void initEventCtas();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
