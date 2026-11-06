/** The pages' JSON-LD, embedded via SeoHead: the series, one meeting, FAQ and breadcrumbs. */
import site from '../../data/site.json';
import type { EventDTO } from './dto';
import { buildEventMeta, type EventMeta, eventName, stripHtml } from './event-meta';
import { eventDay, zonedTime } from './time';

type Schema = Record<string, unknown>;

const organizer = (siteUrl: URL): Schema => ({
  '@type': 'Organization',
  '@id': `${siteUrl.origin}/#organization`,
  name: site.siteName,
  url: siteUrl.origin,
});

/** Meetings run on a donation basis, marked up as a free offer. */
const freeOffer = (url: string, availability = 'https://schema.org/InStock'): Schema => ({
  '@type': 'Offer',
  price: '0',
  priceCurrency: 'EUR',
  availability,
  url,
});

/** The recurring circle as one `EventSeries` entity under one site-level `@id` (`/#series`), emitted by both the home page and /event. */
export function eventSeriesSchema(siteUrl: URL): Schema {
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
      name: site.siteName,
      address: {
        '@type': 'PostalAddress',
        addressLocality: site.geo.locality,
        addressRegion: site.geo.region,
        addressCountry: site.geo.country,
      },
    },
    organizer: organizer(siteUrl),
    offers: freeOffer(seriesUrl),
  };
}

/** Home, then each `[name, url]` level below it. */
export function breadcrumbSchema(siteUrl: URL, levels: [name: string, url: string][]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [['Startseite', siteUrl.origin], ...levels].map(([name, item], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item,
    })),
  };
}

/** An event day and "HH:MM" as a local ISO datetime with the Berlin offset; the day alone without a time. */
function localDateTime(day: string, time: string): string {
  return zonedTime(day, time)?.iso ?? eventDay(day);
}

/** Locality, region and country fall back to the circle's home town so the address is never half-stated; street and postal code are left out instead. */
function buildPlace(event: EventDTO): Record<string, unknown> {
  const hasCoordinates = event.latitude != null && event.longitude != null;

  return {
    '@type': 'Place',
    name: event.location || site.siteName,
    address: {
      '@type': 'PostalAddress',
      ...(event.street ? { streetAddress: event.street } : {}),
      ...(event.postal_code ? { postalCode: event.postal_code } : {}),
      addressLocality: event.city || site.geo.locality,
      addressRegion: site.geo.region,
      addressCountry: site.geo.country,
    },
    ...(hasCoordinates
      ? { geo: { '@type': 'GeoCoordinates', latitude: event.latitude, longitude: event.longitude } }
      : {}),
  };
}

/** Seat numbers, but only where the page states them: a past or full event shows no count, and sold-out is already carried by `offers.availability`. */
function capacity(event: EventDTO): Record<string, number> {
  if (event.max_participants <= 0) return {};

  const max = { maximumAttendeeCapacity: event.max_participants };

  if (event.is_past || event.is_full) return max;

  return { ...max, remainingAttendeeCapacity: Math.max(0, event.available_spots) };
}

export function buildEventSchema(
  event: EventDTO,
  siteUrl: URL,
  meta: EventMeta = buildEventMeta(event, siteUrl),
): Schema {
  const startDate = localDateTime(event.event_date, event.start_time);
  const endDate = event.end_time ? localDateTime(event.event_date, event.end_time) : undefined;
  const url = new URL(`/event/${event.slug}`, siteUrl).href;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': url,
    name: eventName(event),
    description: stripHtml(event.description) || meta.description,
    startDate,
    ...(endDate ? { endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: 'de-DE',
    isAccessibleForFree: true,
    location: buildPlace(event),
    image: [meta.image, ...(meta.extraImage ? [meta.extraImage] : [])],
    url,
    ...capacity(event),
    audience: { '@type': 'Audience', audienceType: 'Männer' },
    organizer: organizer(siteUrl),
    superEvent: {
      '@type': 'EventSeries',
      '@id': `${siteUrl.origin}/#series`,
      name: site.siteName,
      url: new URL('/event', siteUrl).href,
    },
    offers: {
      // A past event cannot be booked either — "InStock" there gets the rich
      // result pulled.
      ...freeOffer(url, event.is_full || event.is_past ? 'https://schema.org/SoldOut' : undefined),
      // Registration closes when the event starts.
      validThrough: startDate,
    },
  };
}
