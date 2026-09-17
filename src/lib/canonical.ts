/**
 * Canonical URL for a page, shared by SeoHead and by pages that embed the same
 * string in structured data. `trailingSlash: 'ignore'` makes `Astro.url.pathname`
 * arrive with a slash on prerendered pages and without one on SSR routes, so
 * callers that build their own string disagree with each other. The slash-less
 * spelling wins: it is what the sitemap lists and what the server redirects to.
 */
export function canonicalUrl(site: URL, pathname: string): string {
  const normalised = pathname.replace(/(.)\/+$/, '$1');
  return new URL(normalised, site).href;
}
