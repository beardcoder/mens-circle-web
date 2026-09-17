/**
 * schema.org/Event JSON-LD, embedded by /event and /event/[slug] via SeoHead.
 *
 * It joins the site's single entity graph: the canonical URL doubles as `@id`
 * (the node /event points at with `subEvent`), `organizer` references
 * `#organization` and `superEvent` references `#series`. Human-readable strings
 * come from lib/event-meta.ts, so markup and share card cannot disagree.
 */
import site from '../data/site.json';
import { buildEventMeta, eventName, stripHtml } from './event-meta';
import type { EventDTO } from './types';

/** DST-aware Europe/Berlin UTC offset (e.g. "+02:00"). */
function berlinOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00';
  const match = tz.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : '+01:00';
}

/** Combine an ISO date + "HH:MM" into a local ISO datetime with Berlin offset. */
function localDateTime(isoDate: string, time: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const datePart = d.toISOString().slice(0, 10);
  if (!/^\d{2}:\d{2}$/.test(time)) return datePart;
  return `${datePart}T${time}:00${berlinOffset(d)}`;
}

/**
 * Locality, region and country fall back to the circle's home town so the
 * address is never half-stated; street and postal code are left out instead.
 */
function buildPlace(event: EventDTO): Record<string, unknown> {
  const hasCoordinates = event.latitude != null && event.longitude != null;
  return {
    '@type': 'Place',
    name: event.location || `Männerkreis ${site.geo.locality}`,
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

/**
 * Seat numbers, but only where the page states them: a past or full event shows
 * no count, and sold-out is already carried by `offers.availability`.
 */
function capacity(event: EventDTO): Record<string, number> {
  if (event.max_participants <= 0) return {};
  const max = { maximumAttendeeCapacity: event.max_participants };
  if (event.is_past || event.is_full) return max;
  return { ...max, remainingAttendeeCapacity: Math.max(0, event.available_spots) };
}

export function buildEventSchema(event: EventDTO, siteUrl: URL): Record<string, unknown> {
  const startDate = localDateTime(event.event_date, event.start_time);
  const endDate = event.end_time ? localDateTime(event.event_date, event.end_time) : undefined;
  const url = new URL(`/event/${event.slug}`, siteUrl).href;
  const meta = buildEventMeta(event, siteUrl);

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
    organizer: {
      '@type': 'Organization',
      '@id': `${siteUrl.origin}/#organization`,
      name: site.siteName,
      url: siteUrl.origin,
    },
    superEvent: {
      '@type': 'EventSeries',
      '@id': `${siteUrl.origin}/#series`,
      name: site.siteName,
      url: new URL('/event', siteUrl).href,
    },
    // Meetings run on a donation basis, marked up as a free offer.
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      // A past event cannot be booked either — "InStock" there gets the rich
      // result pulled.
      availability: event.is_full || event.is_past ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      // Registration closes when the event starts.
      validThrough: startDate,
      url,
    },
  };
}
