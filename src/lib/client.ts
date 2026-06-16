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

import { initEventCtas } from './event-cta';
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

  // Reveal the "next event" CTAs only if an upcoming event is actually
  // scheduled. The pages carrying them are prerendered (static), so this is a
  // runtime check; CTAs are hidden by default, so it never flashes a dead one.
  void initEventCtas();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
