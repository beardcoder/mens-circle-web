/** Client entry — wires up theme, header and the breathing backgrounds. Reveals are pure CSS (utilities/_motion.css). */

import { initBreath } from './breath';
import { initSiteHeader } from './site-header';
import { initTheme } from './theme';

for (const init of [initTheme, initSiteHeader, initBreath]) {
  try {
    init();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[client] ${init.name} failed:`, error);
  }
}
