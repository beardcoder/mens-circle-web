/**
 * The share card for one evening — a real 1200x630 poster with this date on it,
 * rendered per request.
 *
 * Why it exists: a forwarded link is what actually carries this circle to new
 * people, and in WhatsApp and Facebook the image is most of the message. Every
 * event used to share the same generic poster, so ten different evenings looked
 * like one. Now the card *is* the date, set in the site's own poster voice.
 *
 * How it is drawn, and why that shape:
 *
 *   satori lays the card out with flexbox and converts every glyph to an SVG
 *   PATH (no `<text>` survives), then sharp rasterises that path-only SVG to
 *   PNG. The path step is the whole point: it means the renderer needs no fonts
 *   installed anywhere. sharp's bundled libvips cannot draw SVG text at all —
 *   it silently renders nothing, with or without fontconfig — so a card built
 *   as `<text>` would have deployed as a blank rectangle.
 *
 * Both dependencies are server-side only; the pages themselves ship no extra
 * byte. Budget on this machine: ~120ms satori + ~60ms sharp for a ~35KB PNG.
 *
 * The palette and the type are the design system's, not a second look:
 * oat paper, bark ink, burnt orange, Barlow Condensed 800 for the date and 600
 * for the labels, no rounded corners. Orange stays fill and large text only —
 * the status strip is ink ON orange (4.9:1), never the other way round.
 */
import satori from 'satori';
import sharp from 'sharp';
import site from '../../data/site.json';
import { fnv1a } from '../helpers';
import { CARD_HEIGHT, CARD_WIDTH } from '../og-card-size';
import { formatDayMonthYearDE, formatWeekdayDE } from './format';
import { ogFonts } from './og-fonts';

// Declared in lib/og-card-size.ts so a page can state the size in its meta tags
// without importing satori and sharp — see the note there.
export { CARD_HEIGHT, CARD_WIDTH };

const PAPER = '#f2ede3';
const INK = '#1c1714';
const INK_MID = '#4a4139';
const ORANGE = '#dd5f33';

/** What the card has to say. Deliberately not the EventDTO: this module is also
 *  the one that must never reach into the database. */
export interface CardContent {
  /** Small line above the date — the brand, plus the evening's own name when
   *  it has one that is not just "Männerkreis". */
  kicker: string;
  /** "DONNERSTAG", or empty when the date could not be read. */
  weekday: string;
  /** "18. SEPTEMBER 2026" — the poster line. */
  date: string;
  /** "19:00–21:30 UHR · STRAUBING" */
  meta: string;
  /** The orange strip: seats, waiting list, or that the evening is over. */
  status: string;
}

/**
 * The two cuts, decoded once per process.
 *
 * They come from `og-fonts.ts` (generated — `bun run og:fonts`) rather than
 * from disk. Reading them from disk is the obvious approach and it silently
 * does not work: Vite leaves `new URL('…', import.meta.url)` untouched in the
 * Astro SSR build, so the path resolves against `dist/server/chunks/` at
 * runtime and every production card fell back to the static poster. The one
 * failure mode a share card must not have is the quiet one.
 */
let fontCache: { name: string; data: Buffer; weight: 800 | 600; style: 'normal' }[] | null = null;
const loadFonts = () => {
  fontCache ??= ogFonts().map((face) => ({
    name: 'Condensed',
    data: face.data,
    weight: face.weight as 800 | 600,
    style: 'normal' as const,
  }));
  return fontCache;
};

/** German display type is wide. The date line drops a step when it runs long
 *  ("30. SEPTEMBER 2026") so it never collides with the ring or wraps oddly. */
const dateSize = (text: string): number => {
  if (text.length > 18) return 88;
  if (text.length > 15) return 100;
  return 116;
};

/** satori takes React-ish nodes; we build them as plain objects so this file
 *  needs no JSX pragma and no .tsx extension in a project that has none. */
type Node = { type: string; props: Record<string, unknown> };
const box = (style: Record<string, unknown>, children: unknown): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children },
});

/**
 * The ring — the site's one graphic motif, cropped at the card's edge exactly
 * as it is cropped by the viewport on the page, and never over text.
 *
 * Geometry copied from components/Ring.astro: r=88 in a 200 box, stroke 23,
 * and a 470/83 dash that leaves one ~54° opening. The gap is the point — the
 * motif is "a single stroke with one gap in it", and Ring.astro documents why
 * it cannot be a bordered div: a transparent border segment cuts the opening on
 * the diagonal instead of leaving clean butt ends. satori has no SVG elements,
 * but it does take an SVG data URI as an image, so the real stroke goes in.
 */
const R = 88;
const GAP = 83;
const RING_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
  `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${ORANGE}" stroke-width="23"` +
  ` stroke-dasharray="${(2 * Math.PI * R - GAP).toFixed(1)} ${GAP}" stroke-linecap="butt"` +
  ` transform="rotate(-60 100 100)"/></svg>`;

const ring = (): Node => ({
  type: 'img',
  props: {
    src: `data:image/svg+xml;base64,${Buffer.from(RING_SVG).toString('base64')}`,
    width: 560,
    height: 560,
    style: { position: 'absolute', top: -120, right: -190 },
  },
});

function layout(content: CardContent): Node {
  return box(
    {
      position: 'relative',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '100%',
      height: '100%',
      padding: '72px 80px',
      background: PAPER,
      fontFamily: 'Condensed',
      overflow: 'hidden',
    },
    [
      ring(),
      box({ fontSize: 28, fontWeight: 600, letterSpacing: 4, color: ORANGE }, content.kicker.toUpperCase()),
      box({ flexDirection: 'column' }, [
        content.weekday
          ? box({ fontSize: 46, fontWeight: 600, letterSpacing: 2, color: INK_MID }, content.weekday.toUpperCase())
          : box({}, []),
        box(
          {
            fontSize: dateSize(content.date),
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: -1,
            color: INK,
            // German display type overshoots its line box on Ä/Ö/Ü — the same
            // reason `.display` reserves padding on the page.
            paddingTop: 10,
          },
          content.date.toUpperCase(),
        ),
      ]),
      box({ flexDirection: 'column' }, [
        box({ fontSize: 34, fontWeight: 600, color: INK_MID, paddingBottom: 22 }, content.meta.toUpperCase()),
        // Ink on orange, the same pairing the buttons use. White on orange is
        // 3.6:1 and fails; this is 4.9:1.
        box(
          {
            alignSelf: 'flex-start',
            padding: '14px 26px',
            background: ORANGE,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 2,
            color: INK,
          },
          content.status.toUpperCase(),
        ),
      ]),
    ],
  );
}

/** Lay the card out and rasterise it. Throws if satori or sharp fail — the
 *  route is what decides to fall back to the static poster. */
async function draw(content: CardContent): Promise<Uint8Array> {
  const svg = await satori(layout(content) as never, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: loadFonts(),
  });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
}

/**
 * Rendered cards, kept in the process and keyed by what they draw.
 *
 * A card costs ~165ms of mostly *synchronous* CPU (satori lays out and converts
 * every glyph to a path; sharp then rasterises). Nothing used to hold on to the
 * result, so every scrape re-rendered: WhatsApp, Facebook, Signal, Slack, the
 * search crawlers and every CDN revalidation each paid the full price, and on a
 * one-core box that time is not spent in parallel with anything — it is time
 * the server is not answering other requests. That is what a slow site looks
 * like from the outside even when no page got slower.
 *
 * The key is a token over the drawn strings, so a card can never be served for
 * a state it no longer shows: a seat taken changes `status`, which changes the
 * key. Sized for "every event this site will ever have open at once" times a
 * couple of states — 32 entries at ~21KB is under a megabyte, against the ~46MB
 * sharp brings in anyway.
 */
const CACHE_LIMIT = 32;
const rendered = new Map<string, Uint8Array>();
/** Renders in flight, so a crawler hitting one URL n times pays for one. */
const pending = new Map<string, Promise<Uint8Array>>();

/** Everything the card draws, as one short token. */
export const cardFingerprint = (content: CardContent): string =>
  fnv1a([content.kicker, content.weekday, content.date, content.meta, content.status].join('|'));

function remember(key: string, body: Uint8Array): Uint8Array {
  rendered.set(key, body);
  // Map iterates in insertion order and `take` below re-inserts on a hit, so
  // the first key is the least recently used one.
  if (rendered.size > CACHE_LIMIT) rendered.delete(rendered.keys().next().value!);
  return body;
}

function take(key: string): Uint8Array | undefined {
  const hit = rendered.get(key);
  if (!hit) return undefined;
  rendered.delete(key);
  rendered.set(key, hit);
  return hit;
}

/** Render the card to PNG bytes, reusing an identical card already drawn. */
export function renderCard(content: CardContent): Promise<Uint8Array> {
  const key = cardFingerprint(content);
  const hit = take(key);
  if (hit) return Promise.resolve(hit);

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const work = draw(content)
    .then((body) => remember(key, body))
    .finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
}

/** The date/time/place/seat strings a card shows, from the values the event
 *  page already displays. Kept here so the route stays a thin wrapper. */
export interface CardInput {
  title: string;
  eventDate: string;
  timeRange: string;
  place: string;
  isPast: boolean;
  isFull: boolean;
  availableSpots: number;
  maxParticipants: number;
}

function statusText(input: CardInput): string {
  if (input.isPast) return 'Vergangenes Treffen';
  if (input.isFull) return 'Ausgebucht · Warteliste offen';
  if (input.maxParticipants > 0 && input.availableSpots > 0) {
    return `Noch ${input.availableSpots} von ${input.maxParticipants} Plätzen frei`;
  }
  return 'Anmeldung offen';
}

export function cardContent(input: CardInput): CardContent {
  // The brand always leads, so a forwarded card is recognisable; a themed
  // evening adds its own name after it rather than replacing it.
  const ownName = input.title.trim();
  const distinct = ownName && ownName.toLowerCase() !== site.siteName.toLowerCase() && ownName !== 'Männerkreis';

  return {
    kicker: distinct ? `${site.siteName} · ${ownName}` : site.siteName,
    weekday: formatWeekdayDE(input.eventDate),
    date: formatDayMonthYearDE(input.eventDate) || 'Termin folgt',
    meta: [input.timeRange, input.place].filter(Boolean).join(' · '),
    status: statusText(input),
  };
}
