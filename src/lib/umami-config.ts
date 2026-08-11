/**
 * Umami analytics — one source of truth for the website id + endpoint, shared by
 * astro.config.mjs (tracker), Layout.astro (heatmap recorder) and SeoHead.astro
 * (preconnect). They used to re-derive these independently, which is how the
 * recorder ended up loading twice in production.
 *
 * Env first, built-in default second, so a deployment can point at another
 * instance through `PUBLIC_UMAMI_ID` / `PUBLIC_UMAMI_ENDPOINT`.
 *
 * Build-time only — plain data, safe anywhere.
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
