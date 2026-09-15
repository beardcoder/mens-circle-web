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
 * Resolve the card image: the evening's own picture when the admin set one and
 * it resolves to http(s), otherwise the site's 1200x630 poster.
 *
 * The flag matters downstream: `og:image:width/height` may only be emitted for
 * the default, whose dimensions we know. Advertising 1200x630 for an arbitrary
 * uploaded URL is what downgrades a large card to a small one — the bug the
 * default image was introduced to fix, and it would come straight back.
 */
function shareImage(event: EventDTO, siteUrl: URL): { url: string; isDefault: boolean } {
  const raw = event.image_url?.trim();
  if (raw) {
    try {
      const resolved = new URL(raw, siteUrl);
      if (resolved.protocol === 'https:' || resolved.protocol === 'http:') {
        return { url: resolved.href, isDefault: false };
      }
    } catch {
      /* Unparseable admin input — fall through to the default poster. */
    }
  }
  return { url: new URL('/images/og-default.png', siteUrl).href, isDefault: true };
}

export interface EventMeta {
  /** The `<title>`: the evening, its date, and the brand once. */
  title: string;
  /** `og:title` — no SERP length pressure, so it carries the weekday and place. */
  ogTitle: string;
  /** Shared by `<meta name="description">`, `og:description` and the JSON-LD. */
  description: string;
  /** Absolute card image URL. */
  image: string;
  /** True only for the site poster, whose 1200x630 we may advertise. */
  imageIsDefault: boolean;
  imageAlt: string;
  /** Labelled fields for `twitter:label1/data1` and `label2/data2`. */
  details: { label: string; value: string }[];
}

/** Build every string the event page needs for search and sharing. */
export function buildEventMeta(event: EventDTO, siteUrl: URL): EventMeta {
  const name = eventName(event);
  const place = eventPlace(event);
  const day = formatDayMonthYearDE(event.event_date);
  const longDate = formatDateLongDE(event.event_date);
  const { url: image, isDefault } = shareImage(event, siteUrl);

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
    imageIsDefault: isDefault,
    imageAlt: day ? `${name} am ${day} in ${place}` : `${name} in ${place}`,
    details: shareDetails(event),
  };
}
