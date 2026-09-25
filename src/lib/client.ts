/** Client entry — wires up theme, header and scroll reveals. */

import { initMotion } from './motion';
import { initSiteHeader } from './site-header';
import { initTheme } from './theme';

for (const init of [initTheme, initSiteHeader, initMotion]) {
  try {
    init();
  } catch (error) {
    // The reveals are hidden by CSS until they animate in, so a failed
    // initMotion must drop that state rather than wait out the fallback timer.
    if (init === initMotion) document.documentElement.classList.remove('motion-ready');
    // eslint-disable-next-line no-console
    console.error(`[client] ${init.name} failed:`, error);
  }
}
