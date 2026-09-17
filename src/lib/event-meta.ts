/**
 * The share and search metadata for one evening — everything a preview card,
 * a SERP snippet and the page's own `Event` markup say about it.
 *
 * Why this exists as its own module: a link to /event/<slug> is the thing that
 * actually gets forwarded — into a WhatsApp chat, a Signal group, a mail. What
 * those previews render is `og:title` + `og:description` + `og:image`, and the
 * page used to hand them a title without a date ("Männerkreis – Männerkreis
 * Straubing") and a description that made a promise instead of stating a fact
 * ("Sieh dir den Termin an und sichere dir deinen Platz"). Someone receiving
 * that link could not tell *when* the evening is without opening it, which is
 * the one question a forwarded invitation has to answer.
 *
 * So the strings are built from the record: date, time, place, and the seat
 * situation the page itself shows. `lib/event-schema.ts` builds its JSON-LD
 * from the same functions, so the structured data and the visible metadata
 * cannot drift apart.
 *
 * Nothing here asserts anything the page does not show: the capacity sentence
 * mirrors `EventRegister.astro`, the date and place mirror `EventHero.astro`.
 *
 * Server-render only — it imports lib/server/format.
 */
import site from '../data/site.json';
import { formatDateLongDE, formatDayMonthYearDE } from './server/format';
import type { EventDTO } from './types';

/** Meta descriptions get cut around 160 chars in a SERP, but a chat preview
 *  shows more, so the budget is the preview's rather than Google's. */
const DESCRIPTION_LIMIT = 200;

/**
 * Strip inline HTML so a value is safe as plain text.
 *
 * Repeats until stable: a single pass can leave injectable residue on nested or
 * malformed markup (e.g. `<scr<script>ipt>`), and these values end up both in a
 * JSON-LD `<script>` block and in a `content=""` attribute, so no `</script>`
 * and no stray quote may survive.
 */
export function stripHtml(value = ''): string {
  let previous: string;
  let out = value;
  do {
    previous = out;
    out = out.replace(/<[^>]*>/g, '');
  } while (out !== previous);
  return out.replace(/\s+/g, ' ').trim();
}

/** Cut to `limit` on a word boundary rather than mid-word. */
function truncate(text: string, limit = DESCRIPTION_LIMIT): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  const kept = space > limit / 2 ? cut.slice(0, space) : cut;
  return `${kept.replace(/[\s.,;:–-]+$/, '')}…`;
}

/** The evening's own title, or the circle's name when the admin left it empty. */
export const eventName = (event: EventDTO): string => stripHtml(event.title) || `Männerkreis ${site.geo.locality}`;

/** City, falling back to the venue name and then the circle's home town — the
 *  same ladder `summarizeNextEvent` uses, so /event and /event/<slug> agree. */
export const eventPlace = (event: EventDTO): string =>
  event.city?.trim() || event.location?.trim() || site.geo.locality;

/** "19:00–21:30 Uhr", or empty when no start time is set. */
export const eventTimeRange = (event: EventDTO): string =>
  event.start_time ? `${event.start_time}${event.end_time ? `–${event.end_time}` : ''} Uhr` : '';

/** "Donnerstag, 18. September 2026, 19:00–21:30 Uhr in Straubing" — the single
 *  line that answers "when and where" for someone who was forwarded the link. */
export const eventWhenWhere = (event: EventDTO): string => {
  const when = [formatDateLongDE(event.event_date), eventTimeRange(event)].filter(Boolean).join(', ');
  const place = eventPlace(event);
  return when ? `${when} in ${place}` : `Männerkreis in ${place}`;
};

/** The seat situation, in the same words the registration section uses. */
function statusSentence(event: EventDTO): string {
  if (event.is_past) return 'Dieser Abend hat bereits stattgefunden.';
  if (event.is_full)
    return 'Der Abend ist ausgebucht – über die Warteliste rückst du nach, sobald ein Platz frei wird.';
  if (event.max_participants > 0 && event.available_spots > 0) {
    return `Noch ${event.available_spots} von ${event.max_participants} Plätzen frei.`;
  }
  return 'Anmeldung online, ohne Vorerfahrung.';
}

/** Ensure a free-text fragment reads as a sentence. Every part of the
 *  description goes through this — the parts are joined with a plain space, so
 *  a missing full stop runs two facts together ("… in Straubing Noch 4 von 12
 *  Plätzen frei."). */
const asSentence = (text: string): string => (/[.!?…]$/.test(text) ? text : `${text}.`);

/** The closing clause: what Markus wrote about this evening wins, because it is
 *  the one thing that distinguishes it from every other date; otherwise the
 *  evening's fee, otherwise the evergreen line. */
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

/**
 * The site's standing 1200x630 poster — `public/images/og-default.png`.
 *
 * Every event page shares it. The per-event card that used to be generated
 * here is gone: rendering it cost a native image stack (satori + sharp) in the
 * one long-lived web process, and the date it carried is already in `ogTitle`
 * and in the description, which is what a WhatsApp or Facebook preview shows
 * as text next to the picture. `SeoHead.astro` reaches for the same file when
 * a page passes no image of its own, so the `og:image` and the JSON-LD agree.
 */
export const defaultImage = (siteUrl: URL): string => new URL('/images/og-default.png', siteUrl).href;

/**
 * The evening's own picture, when the admin entered a usable http(s) URL.
 *
 * A real image of this evening, so it goes out as a second `image` in the
 * structured data, where Google takes a list. It stays out of `og:image`: the
 * dimensions of an arbitrary admin-entered URL are unknown, and a declared
 * size that does not match the file downgrades a large share card to a small
 * one.
 */
export function adminImage(event: EventDTO, siteUrl: URL): string | null {
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
  /** The `<title>`: the evening, its date, and the brand once. */
  title: string;
  /** `og:title` — no SERP length pressure, so it carries the weekday and place. */
  ogTitle: string;
  /** Shared by `<meta name="description">`, `og:description` and the JSON-LD. */
  description: string;
  /** Absolute URL of the standing 1200x630 poster — the JSON-LD's first
   *  `image`, and what `SeoHead.astro` emits as `og:image`. */
  image: string;
  /** The evening's own picture, when the admin set one — extra `image` for the
   *  structured data, never the `og:image`. */
  extraImage: string | null;
  /** Labelled fields for `twitter:label1/data1` and `label2/data2`. */
  details: { label: string; value: string }[];
}

/** Build every string the event page needs for search and sharing. */
export function buildEventMeta(event: EventDTO, siteUrl: URL): EventMeta {
  const name = eventName(event);
  const place = eventPlace(event);
  const day = formatDayMonthYearDE(event.event_date);
  const longDate = formatDateLongDE(event.event_date);
  const image = defaultImage(siteUrl);

  // The brand is appended only when the evening's own title does not already
  // carry it — "Männerkreis Straubing am 18. September 2026 – Männerkreis
  // Straubing" says the name twice and eats the 60 chars a SERP shows.
  const brand = name.toLowerCase().includes(site.siteName.toLowerCase()) ? '' : ` – ${site.siteName}`;

  return {
    title: day ? `${name} am ${day}${brand}` : `${name}${brand}`,
    ogTitle: longDate ? `${name} am ${longDate} in ${place}` : `${name} in ${place}`,
    description: truncate(
      [eventWhenWhere(event), statusSentence(event), tailSentence(event)].map(asSentence).join(' '),
    ),
    image,
    extraImage: adminImage(event, siteUrl),
    details: shareDetails(event),
  };
}
