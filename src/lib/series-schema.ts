import site from '../data/site.json';

/** The recurring circle as one `EventSeries` entity under one site-level `@id` (`/#series`), emitted by both the home page and /event. */
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
    // Meetings run on a donation basis, marked up as a free offer.
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: seriesUrl,
    },
  };
}
