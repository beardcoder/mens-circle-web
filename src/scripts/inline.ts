/**
 * The inline scripts of every public <head> (Layout.astro). The page CSP admits
 * inline scripts by hash only; astro.config.mjs hashes these exact strings
 * (`inlineScriptHashes`), so render them with `set:html` and nothing else.
 */
import bootScript from './boot.js?raw';
import fontScript from './load-fonts.js?raw';
import rules from './speculation-rules.json';

/**
 * Chromium fetches a same-origin page when its link is hovered or pressed, with no
 * script on the page; other browsers simply navigate. Never the back office or the API.
 */
const speculationRules = JSON.stringify(rules);

export { bootScript, fontScript, speculationRules };
