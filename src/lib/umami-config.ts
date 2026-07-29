/**
 * Umami analytics — the single source of truth for the website id + endpoint.
 *
 * Three places need these two values and they used to hardcode or re-derive
 * them independently, which is how the site ended up loading the heatmap
 * recorder twice in production:
 *
 *   • astro.config.mjs  → the `@yeskunall/astro-umami` integration (tracker)
 *   • layouts/Layout.astro → the optional heatmap recorder script
 *   • components/SeoHead.astro → the `preconnect` to the analytics origin
 *
 * Resolution order is env first, built-in default second, so a deployment can
 * point at a different Umami instance (or a staging one) purely through
 * `PUBLIC_UMAMI_ID` / `PUBLIC_UMAMI_ENDPOINT` without touching code, while a
 * deploy that sets neither keeps tracking exactly as before.
 *
 * Build-time only — plain data, no runtime/server imports, safe in the config,
 * in .astro frontmatter and in client code alike.
 */

/** The production Männerkreis Umami property. */
const DEFAULT_WEBSITE_ID = 'f2964cb9-28e6-4658-810f-2acfb9cb9c46';

/** The self-hosted Umami instance. */
const DEFAULT_ENDPOINT = 'https://va.letsbenow.de';

const env = (key: string): string => {
  // `import.meta.env` in Astro/Vite contexts (components, client bundles),
  // `process.env` in the plain-Node context that loads astro.config.mjs.
  const fromVite = import.meta.env?.[key];
  if (typeof fromVite === 'string' && fromVite.length > 0) return fromVite;
  const fromProcess = typeof process === 'undefined' ? undefined : process.env?.[key];
  return typeof fromProcess === 'string' ? fromProcess : '';
};

export const UMAMI_WEBSITE_ID: string = env('PUBLIC_UMAMI_ID') || DEFAULT_WEBSITE_ID;

/** Endpoint without a trailing slash, so `${endpoint}/script.js` is safe. */
export const UMAMI_ENDPOINT: string = (env('PUBLIC_UMAMI_ENDPOINT') || DEFAULT_ENDPOINT).replace(/\/+$/, '');

/** Origin to `preconnect` to, or `null` when the endpoint isn't a valid URL. */
export const umamiOrigin = (): string | null => {
  try {
    return new URL(UMAMI_ENDPOINT).origin;
  } catch {
    return null;
  }
};
