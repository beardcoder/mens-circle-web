/**
 * Build schema.org/Event JSON-LD from an event DTO.
 *
 * The /event and /event/[slug] pages advertise themselves as events but
 * previously shipped no structured data, so Google had nothing to build an
 * Event rich result (date, location, availability) from. This helper turns the
 * public DTO into valid Event markup that both pages embed via <SeoHead
 * schemas>.
 *
 * It joins the site's one entity graph rather than starting a second one:
 *
 *   - the Event carries its canonical URL as `@id`, which is exactly the id
 *     /event points at with `subEvent` — without it that reference dangled,
 *     and the series and the meeting were two unconnected things;
 *   - `organizer` references `#organization` and `superEvent` references
 *     `#series`, both defined once (SeoHead and lib/series-schema.ts).
 *
 * The human-readable strings come from lib/event-meta.ts, the same module the
 * page's title and Open Graph tags read, so the markup and the card cannot
 * disagree about when the evening is or whether seats are left.
 */
import site from '../data/site.json';
import { buildEventMeta, eventName, stripHtml } from './event-meta';
import type { EventDTO } from './types';

/** DST-aware Europe/Berlin UTC offset (e.g. "+02:00") for a given instant. */
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
  const datePart = d.toISOString().slice(0, 10); // YYYY-MM-DD
  if (!/^\d{2}:\d{2}$/.test(time)) return datePart;
  return `${datePart}T${time}:00${berlinOffset(d)}`;
}

/**
 * The `Place` an event happens at.
 *
 * Locality, region and country always fall back to the circle's home town, so
 * the address is never half-stated; street and postal code are simply left out
 * when the event does not carry them.
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
 * Seats, as numbers, but only where the page states them.
 *
 * `EventRegister.astro` prints "Von N Plätzen sind noch M frei" for an open
 * evening — so both numbers are fair game there. A past or full evening shows
 * no count, and a remaining capacity of 0 on a sold-out date is already carried
 * by `offers.availability`, so only the ceiling goes out.
 */
function capacity(event: EventDTO): Record<string, number> {
  if (event.max_participants <= 0) return {};
  const max = { maximumAttendeeCapacity: event.max_participants };
  if (event.is_past || event.is_full) return max;
  return { ...max, remainingAttendeeCapacity: Math.max(0, event.available_spots) };
}

/** Build a schema.org/Event object for an event, resolving URLs against `siteUrl`. */
export function buildEventSchema(event: EventDTO, siteUrl: URL): Record<string, unknown> {
  const startDate = localDateTime(event.event_date, event.start_time);
  const endDate = event.end_time ? localDateTime(event.event_date, event.end_time) : undefined;
  const url = new URL(`/event/${event.slug}`, siteUrl).href;
  const meta = buildEventMeta(event, siteUrl);

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    // The canonical URL doubles as the id, so /event's `subEvent` reference
    // resolves to this node instead of dangling.
    '@id': url,
    name: eventName(event),
    // The evening's own text when there is one, otherwise the same factual
    // summary the meta description carries — never an empty description.
    description: stripHtml(event.description) || meta.description,
    startDate,
    ...(endDate ? { endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: 'de-DE',
    isAccessibleForFree: true,
    location: buildPlace(event),
    image: [meta.image],
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
    // Treffen laufen auf Spendenbasis — als kostenfreies Angebot ausgezeichnet.
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      // A past evening cannot be booked either, and saying "InStock" about one
      // is the kind of claim that gets an Event rich result pulled.
      availability: event.is_full || event.is_past ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      // Registration closes when the evening starts.
      validThrough: startDate,
      url,
    },
  };
}
