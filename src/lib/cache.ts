/**
 * Cache-Control for the four prerendered documents. Browsers revalidate (the HTML
 * names per-build assets); a shared cache may serve it for 5 minutes. Only safe with
 * a stable build-time ASTRO_KEY, otherwise cached HTML breaks the server islands:
 * without the key, use 'no-cache'.
 */
export const PRERENDERED_CACHE_CONTROL = 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=60';
