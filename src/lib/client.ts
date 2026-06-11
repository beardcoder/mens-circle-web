/**
 * Client entry — page-level initialisers.
 *
 * Imported by the Astro layout as a client script. Wires up the vanilla
 * site header, scroll reveals and Umami engagement tracking once the DOM
 * is ready. The `.motion-ready` class is added inline in the layout head,
 * so nothing is done here for FOUC gating.
 *
 * Each initialiser is wrapped in try/catch so one failing feature never
 * blocks the others — failures are logged, never swallowed. A module-level
 * flag guards against double-initialisation (safe to re-run).
 */

import { initMotion } from './motion';
import { initSiteHeader } from './site-header';
import { initUmamiKit } from './umami-kit';

let initialised = false;

function init(): void {
  if (initialised) return;
  initialised = true;

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

  try {
    initUmamiKit();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[client] initUmamiKit failed:', error);
  }

  // The "next event" CTAs are gated statically at build time (see the
  // `has-upcoming-event` body class), so there is nothing to wire up here.
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
