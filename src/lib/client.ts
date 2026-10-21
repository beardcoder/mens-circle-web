/** Client entry — wires up the display mode, the header and the folding voices. */

import { initBreath } from './breath';
import { initQuotes } from './quotes';
import { initSiteHeader } from './site-header';
import { initTheme } from './theme';

for (const init of [initTheme, initSiteHeader, initQuotes, initBreath]) {
  try {
    init();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[client] ${init.name} failed:`, error);
  }
}
