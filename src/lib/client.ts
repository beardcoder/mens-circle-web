/** Client entry — wires up theme and header. Reveals are pure CSS (utilities/_motion.css). */

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
