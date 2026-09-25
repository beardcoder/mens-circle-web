/** Canonical URL for a page, shared by SeoHead and by pages that embed the same string in structured data. */
export function canonicalUrl(site: URL, pathname: string): string {
  const normalised = pathname.replace(/(.)\/+$/, '$1');
  return new URL(normalised, site).href;
}
