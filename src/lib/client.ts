/** Client entry — wires up theme and header. Scroll motion is CSS only. */

import { initSiteHeader } from './site-header';
import { initTheme } from './theme';

for (const init of [initTheme, initSiteHeader]) {
  try {
    init();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[client] ${init.name} failed:`, error);
  }
}
