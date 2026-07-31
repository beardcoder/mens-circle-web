/**
 * Content for the /event landing page.
 *
 * This lives outside the component on purpose: the page renders these strings
 * AND emits them as JSON-LD (FAQPage). Google treats FAQ markup that doesn't
 * match the visible text as a structured-data violation, so both have to read
 * from one source — hence a module rather than copy in two places.
 *
 * Every factual claim traces back to copy already in src/content/home.json
 * (Straubing, alle zwei bis vier Wochen, 2–3 Stunden, Spendenbasis,
 * Vertraulichkeit, keine Vorerfahrung nötig). Nothing here is invented.
 *
 * Server-render only. It imports the date formatters from lib/server/format,
 * which is safe — that module's only server import is a `type`, so nothing pulls
 * `bun:sqlite` — but this module still has no business in a client bundle.
 */
import type { EventDTO } from './types';
import { formatDayMonthYearDE, formatWeekdayDE } from './server/format';
import site from '../data/site.json';

export interface FaqEntry {
  question: string;
  answer: string;
}

/** The upcoming event reduced to the strings the landing page actually shows. */
export interface NextEventSummary {
  slug: string;
  /** "Donnerstag, 18. September 2026" */
  dateLabel: string;
  /** "19:00–21:30 Uhr", or empty when no time is set. */
  timeRange: string;
  /** City, falling back to the venue name and then the site's own locality. */
  place: string;
  isFull: boolean;
  availableSpots: number;
  maxParticipants: number;
}

export const summarizeNextEvent = (event: EventDTO | null): NextEventSummary | null => {
  if (!event) return null;

  const weekday = formatWeekdayDE(event.event_date);
  const dayMonthYear = formatDayMonthYearDE(event.event_date);

  return {
    slug: event.slug,
    dateLabel: [weekday, dayMonthYear].filter(Boolean).join(', '),
    timeRange: event.start_time ? `${event.start_time}${event.end_time ? `–${event.end_time}` : ''} Uhr` : '',
    place: event.city || event.location || site.geo.locality,
    isFull: event.is_full,
    availableSpots: event.available_spots,
    maxParticipants: event.max_participants,
  };
};

/**
 * The evening's rhythm. Phrased for "what happens when I walk in", so it
 * complements the home page's "Die Reise" block rather than repeating it —
 * duplicate copy across two indexed URLs helps neither of them.
 */
export const EVENT_RHYTHM = [
  {
    step: '01',
    title: 'Ankommen',
    text: 'Wir starten mit einer Runde, in der jeder kurz sagt, wie er gerade da ist – körperlich, emotional, mental. Kein Vorstellungsmarathon, kein Smalltalk.',
  },
  {
    step: '02',
    title: 'Öffnen',
    text: 'Was dich beschäftigt, bekommt Raum. Du entscheidest selbst, wie viel du teilst – zuhören ist genauso wertvoll wie sprechen.',
  },
  {
    step: '03',
    title: 'Wachsen',
    text: 'Durch ehrliche Rückmeldung und Spiegelung entstehen Perspektiven, auf die man alleine nicht kommt.',
  },
  {
    step: '04',
    title: 'Integrieren',
    text: 'Zum Schluss verankern wir das Erlebte: Was nimmst du mit in deinen Alltag?',
  },
] as const;

/** Hard facts about attending, each traceable to the existing FAQ copy. */
export const EVENT_FACTS = [
  { label: 'Wo', value: 'Straubing', sub: 'Niederbayern – den genauen Ort bekommst du mit der Anmeldung' },
  { label: 'Wie oft', value: 'Alle 2–4 Wochen', sub: 'Die Treffen finden regelmäßig statt' },
  { label: 'Dauer', value: '2–3 Stunden', sub: 'Ein Abend, kein Wochenendseminar' },
  { label: 'Beitrag', value: 'Spendenbasis', sub: 'Jeder gibt, was er kann – Geld soll niemanden abhalten' },
] as const;

/**
 * Participation-intent questions, deliberately distinct from the home page's
 * FAQ set (which answers "what is a Männerkreis at all"). Two FAQPage blocks
 * asking the same questions on two URLs would just compete with each other.
 *
 * The first answer is the only one that depends on live data, which is exactly
 * why this is a function.
 */
export const buildEventFaq = (next: NextEventSummary | null): FaqEntry[] => [
  {
    question: 'Wann findet der nächste Männerkreis statt?',
    answer: next
      ? `Der nächste Termin ist ${next.dateLabel}${next.timeRange ? ` um ${next.timeRange}` : ''} in ${next.place}. Alle Details und die Anmeldung findest du auf der Terminseite.`
      : 'Der nächste Termin steht noch nicht fest. Sobald er geplant ist, erfährst du es über den Newsletter oder die WhatsApp-Community – beide findest du auf dieser Seite.',
  },
  {
    question: 'Wie melde ich mich für einen Termin an?',
    answer:
      'Über das Anmeldeformular auf der jeweiligen Terminseite. Du brauchst nur Vor- und Nachnamen und eine E-Mail-Adresse. Danach erhältst du eine Bestätigung per E-Mail mit dem genauen Treffpunkt. Ist ein Abend ausgebucht, kommst du auf die Warteliste und rückst automatisch nach, sobald ein Platz frei wird.',
  },
  {
    question: 'Wo genau treffen wir uns?',
    answer:
      'Der Männerkreis findet in Straubing in Niederbayern statt. Die genaue Adresse teilen wir mit der Anmeldebestätigung mit – so bleibt der Raum ein geschützter Ort für die Gruppe, die tatsächlich zusammenkommt.',
  },
  {
    question: 'Muss ich Vorerfahrung mitbringen?',
    answer:
      'Nein. Es ist völlig in Ordnung, wenn du noch nie in einem Männerkreis warst. Du musst nichts vorbereiten und nichts können. Die einzige Voraussetzung ist die Bereitschaft, dich einzulassen und den anderen respektvoll zu begegnen.',
  },
  {
    question: 'Was kostet ein Abend?',
    answer:
      'Der Kreis läuft auf Spendenbasis. Du gibst, was dir der Abend wert ist und was für dich machbar ist. Es gibt keinen festen Preis und keine Mitgliedschaft.',
  },
  {
    question: 'Bleibt das, was ich erzähle, im Kreis?',
    answer:
      'Ja. Vertraulichkeit ist das Fundament: Alles, was im Kreis geteilt wird, bleibt im Kreis. Das gilt für alle Teilnehmer gleichermaßen und wird zu Beginn jedes Abends benannt.',
  },
];
