/**
 * Build schema.org/Event JSON-LD from an event DTO.
 *
 * The /event and /event/[slug] pages advertise themselves as events
 * (`og:type=event`) but previously shipped no structured data, so Google had
 * nothing to build an Event rich result (date, location, availability) from.
 * This helper turns the public DTO into valid Event markup that both pages
 * embed via <SeoHead schemas>.
 */
import type { EventDTO } from './types';
import site from '../data/site.json';

/** Strip inline HTML so schema text values stay plain.
 *
 * Repeats until stable: a single pass can leave injectable residue on nested or
 * malformed markup (e.g. `<scr<script>ipt>`), and these values are embedded into
 * a JSON-LD `<script>` block, so a stray `</script>` must not survive. */
function strip(s = ''): string {
  let prev: string;
  let out = s;
  do {
    prev = out;
    out = out.replace(/<[^>]*>/g, '');
  } while (out !== prev);
  return out.trim();
}

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

/** Build a schema.org/Event object for an event, resolving URLs against `siteUrl`. */
export function buildEventSchema(event: EventDTO, siteUrl: URL): Record<string, unknown> {
  const startDate = localDateTime(event.event_date, event.start_time);
  const endDate = event.end_time ? localDateTime(event.event_date, event.end_time) : undefined;
  const url = new URL(`/event/${event.slug}`, siteUrl).href;

  const hasAddress = Boolean(event.street || event.postal_code || event.city);
  const location: Record<string, unknown> = {
    '@type': 'Place',
    name: event.location || `Männerkreis ${site.geo.locality}`,
    address: {
      '@type': 'PostalAddress',
      ...(hasAddress && event.street ? { streetAddress: event.street } : {}),
      ...(hasAddress && event.postal_code ? { postalCode: event.postal_code } : {}),
      addressLocality: event.city || site.geo.locality,
      addressRegion: site.geo.region,
      addressCountry: site.geo.country,
    },
    ...(event.latitude != null && event.longitude != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: event.latitude, longitude: event.longitude } }
      : {}),
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: strip(event.title) || `Männerkreis ${site.geo.locality}`,
    ...(event.description ? { description: strip(event.description) } : {}),
    startDate,
    ...(endDate ? { endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location,
    image: [new URL(event.image_url || '/images/logo-color.png', siteUrl).href],
    url,
    organizer: {
      '@type': 'Organization',
      name: 'Männerkreis Niederbayern/ Straubing',
      url: siteUrl.origin,
    },
    // Treffen laufen auf Spendenbasis — als kostenfreies Angebot ausgezeichnet.
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      availability: event.is_full ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url,
    },
  };
}
