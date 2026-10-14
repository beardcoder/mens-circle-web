/**
 * Cache-Control for the prerendered documents (legal pages, the personal page, the
 * testimonial form). Browsers revalidate (the HTML names per-build assets); a shared
 * cache may serve it for 5 minutes. None of them holds live data.
 */
export const PRERENDERED_CACHE_CONTROL = 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=60';
