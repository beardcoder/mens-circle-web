import site from '../data/site.json';

/**
 * The recurring Männerkreis as one `EventSeries` entity.
 *
 * The home page and /event both describe it, and they used to each emit their
 * own copy under a different `@id` (`/#series` vs `/event#series`) and a
 * different `name` ("Männerkreis Straubing / Niederbayern" vs "Männerkreis
 * Straubing"). That is two entities for one real-world thing: a crawler has no
 * way to know they are the same circle, and the conflicting names are exactly
 * the kind of ambiguity that keeps a knowledge panel from forming.
 *
 * So there is one `@id`, site-level (`/#series`), built here and emitted by both
 * pages. `url` points at /event, because that is the page about the series —
 * the home page is about the circle as a whole.
 *
 * Everything stated here is also stated in visible copy (the facts band on the
 * home page, the facts list on /event), so the markup cannot drift away from
 * what a reader sees. Nothing is asserted that the page does not show.
 */
export function eventSeriesSchema(siteUrl: URL): Record<string, unknown> {
  const seriesUrl = new URL('/event', siteUrl).href;

  return {
    '@context': 'https://schema.org',
    '@type': 'EventSeries',
    '@id': `${siteUrl.origin}/#series`,
    name: site.siteName,
    description:
      'Regelmäßiger Männerkreis in Straubing, Niederbayern: Männer sitzen zusammen, hören einander zu und sprechen über das, was sie gerade beschäftigt. Alle zwei bis vier Wochen, zwei bis drei Stunden, auf Spendenbasis und ohne Vorerfahrung.',
    url: seriesUrl,
    inLanguage: 'de-DE',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    audience: { '@type': 'Audience', audienceType: 'Männer' },
    location: {
      '@type': 'Place',
      name: `Männerkreis ${site.geo.locality}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: site.geo.locality,
        addressRegion: site.geo.region,
        addressCountry: site.geo.country,
      },
    },
    organizer: {
      '@type': 'Organization',
      '@id': `${siteUrl.origin}/#organization`,
      name: site.siteName,
      url: siteUrl.origin,
    },
    // Treffen laufen auf Spendenbasis — als kostenfreies Angebot ausgezeichnet.
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: seriesUrl,
    },
  };
}
