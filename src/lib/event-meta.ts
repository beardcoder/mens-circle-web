/** Share and search metadata for one event. */
import site from '../data/site.json';
import { formatDateLongDE, formatDayMonthYearDE, timeRange } from './server/format';
import type { EventDTO } from './types';

/** Chat previews show more than a SERP's ~160 chars, so budget for the preview. */
const DESCRIPTION_LIMIT = 200;

/** Strip inline HTML so a value is safe as plain text. */
export function stripHtml(value = ''): string {
  let previous: string;
  let out = value;
  do {
    previous = out;
    out = out.replace(/<[^>]*>/g, '');
  } while (out !== previous);
  return out.replace(/\s+/g, ' ').trim();
}

/** Cut to `limit` on a word boundary. */
function truncate(text: string, limit = DESCRIPTION_LIMIT): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  const kept = space > limit / 2 ? cut.slice(0, space) : cut;
  return `${kept.replace(/[\s.,;:–-]+$/, '')}…`;
}

/** The event's own title, or the circle's name when it was left empty. */
export const eventName = (event: EventDTO): string => stripHtml(event.title) || `Männerkreis ${site.geo.locality}`;

/** City, then venue name, then home town. */
export const eventPlace = (event: EventDTO): string =>
  event.city?.trim() || event.location?.trim() || site.geo.locality;

const eventTimeRange = (event: EventDTO): string => timeRange(event.start_time, event.end_time);

/** The single line answering "when and where" for a forwarded link. */
export const eventWhenWhere = (event: EventDTO): string => {
  const when = [formatDateLongDE(event.event_date), eventTimeRange(event)].filter(Boolean).join(', ');
  const place = eventPlace(event);
  return when ? `${when} in ${place}` : `Männerkreis in ${place}`;
};

/** The seat situation, in the words the registration section uses. */
function statusSentence(event: EventDTO): string {
  if (event.is_past) return 'Dieser Abend hat bereits stattgefunden.';
  if (event.is_full)
    return 'Der Abend ist ausgebucht – über die Warteliste rückst du nach, sobald ein Platz frei wird.';
  if (event.max_participants > 0 && event.available_spots > 0) {
    return `Noch ${event.available_spots} von ${event.max_participants} Plätzen frei.`;
  }
  return 'Anmeldung online, ohne Vorerfahrung.';
}

/** Terminate a fragment: the description parts are joined with a plain space,
 *  so a missing full stop would run two facts together. */
const asSentence = (text: string): string => (/[.!?…]$/.test(text) ? text : `${text}.`);

/** Closing clause: the event's own text, else its fee, else the evergreen line. */
function tailSentence(event: EventDTO): string {
  const own = stripHtml(event.description)
    .split(/(?<=[.!?])\s/)[0]
    ?.trim();
  if (own) return asSentence(own);
  const fee = event.cost_basis?.trim();
  return fee ? asSentence(fee) : 'Auf Spendenbasis und ohne Vorerfahrung.';
}

/** Two facts a card can render as labelled fields (Slack and X both do). */
function shareDetails(event: EventDTO): { label: string; value: string }[] {
  const when = [formatDateLongDE(event.event_date), eventTimeRange(event)].filter(Boolean).join(', ');
  return [
    { label: event.is_past ? 'Termin (vorbei)' : 'Termin', value: when || 'Termin folgt' },
    { label: 'Ort', value: eventPlace(event) },
  ];
}

/** Optional admin-supplied image, added to the JSON-LD only. */
function adminImage(event: EventDTO, siteUrl: URL): string | null {
  const raw = event.image_url?.trim();
  if (!raw) return null;
  try {
    const resolved = new URL(raw, siteUrl);
    return resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.href : null;
  } catch {
    return null;
  }
}

export interface EventMeta {
  title: string;
  /** No SERP length pressure, so this carries the weekday and place too. */
  ogTitle: string;
  /** Shared by `<meta name="description">`, `og:description` and the JSON-LD. */
  description: string;
  image: string;
  imageAlt: string;
  /** Structured data only, never the share card. */
  extraImage: string | null;
  /** Fields for `twitter:label1/data1` and `label2/data2`. */
  details: { label: string; value: string }[];
}

export function buildEventMeta(event: EventDTO, siteUrl: URL): EventMeta {
  const name = eventName(event);
  const place = eventPlace(event);
  const day = formatDayMonthYearDE(event.event_date);
  const longDate = formatDateLongDE(event.event_date);
  // One static 1200×630 poster for every event — SeoHead's default image.
  const image = new URL('/images/og-default.png', siteUrl).href;

  // Only append the brand when the title does not already carry it — saying the
  // name twice eats the 60 chars a SERP shows.
  const brand = name.toLowerCase().includes(site.siteName.toLowerCase()) ? '' : ` – ${site.siteName}`;

  return {
    title: day ? `${name} am ${day}${brand}` : `${name}${brand}`,
    ogTitle: longDate ? `${name} am ${longDate} in ${place}` : `${name} in ${place}`,
    description: truncate(
      [eventWhenWhere(event), statusSentence(event), tailSentence(event)].map(asSentence).join(' '),
    ),
    image,
    imageAlt: site.siteName,
    extraImage: adminImage(event, siteUrl),
    details: shareDetails(event),
  };
}
