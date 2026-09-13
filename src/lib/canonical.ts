/**
 * The canonical URL for a page — one definition, used by `SeoHead` for the
 * `<link rel="canonical">` and by the pages that need the same string inside
 * their structured data.
 *
 * Why it has to be shared: `trailingSlash: 'ignore'` plus `build.format`
 * means `Astro.url.pathname` arrives with a trailing slash for prerendered
 * pages and without one for SSR routes. Each caller used to run its own
 * `new URL(Astro.url.pathname, site)`, so the `<link rel="canonical">` and the
 * `@id` of the page's own Article pointed at two spellings of one URL — enough
 * for a JSON-LD reference to dangle, and enough to split a signal that is meant
 * to be the tie-breaker for duplicate content.
 *
 * The slash-less spelling wins because that is what the sitemap lists and what
 * the production server redirects to.
 */
export function canonicalUrl(site: URL, pathname: string): string {
  // Strip trailing slashes, but never reduce the root to an empty path.
  const normalised = pathname.replace(/(.)\/+$/, '$1');
  return new URL(normalised, site).href;
}
