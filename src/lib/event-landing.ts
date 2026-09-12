/**
 * Content and display helpers for the pages that talk about dates.
 *
 * Kept outside the components because the /event page both renders these strings
 * and emits some as JSON-LD (FAQPage) — Google flags FAQ markup that doesn't
 * match the visible text, so both must read from one source.
 *
 * The editorial constants that used to live here (the evening's rhythm, the
 * ground rules, the boundary list, the "what you don't need to bring" list) are
 * gone: those sections now appear once, on the home page, and their copy lives
 * in src/content/home.json with the rest of the editable content. What remains
 * is what is genuinely date-shaped — the facts row and the questions someone
 * asks right before signing up.
 *
 * The FAQ set here is deliberately disjoint from the home page's: two FAQPage
 * blocks asking the same questions on two URLs would only compete. The home page
 * answers "what is this at all", this one answers "how do I take part".
 *
 * Server-render only — it imports lib/server/format, so it has no business in a
 * client bundle.
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
  /** Free-text participation fee for this evening, empty when not set. */
  costBasis: string;
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
    costBasis: event.cost_basis?.trim() ?? '',
    isFull: event.is_full,
    availableSpots: event.available_spots,
    maxParticipants: event.max_participants,
  };
};

export interface EventFact {
  label: string;
  value: string;
  sub: string;
}

/**
 * The quick-scan facts. General by nature, but a scheduled evening overrides
 * what it actually knows: its city, its time window, its participation fee. The
 * venue is never hardcoded beyond the city — the exact address only goes out
 * with the registration confirmation.
 */
export const buildEventFacts = (next: NextEventSummary | null): EventFact[] => [
  {
    label: 'Wo',
    value: next?.place || site.geo.locality,
    sub: 'Die genaue Adresse bekommst du mit der Anmeldung',
  },
  {
    label: 'Wie oft',
    // Non-breaking space after "Alle": set large and condensed, this value wraps,
    // and the only acceptable break is before "Wochen" — not between the 2 and
    // the 4, which reads as a stray hyphen.
    value: 'Alle\u00A02–4 Wochen',
    sub: 'Ein fester Rhythmus, keine Mitgliedschaft',
  },
  {
    label: 'Dauer',
    value: '2–3 Stunden',
    sub: next?.timeRange ? `Nächster Termin: ${next.timeRange}` : 'Ein Abend, kein Wochenendseminar',
  },
  {
    // The evening's own fee text wins when the admin set one — it may name a
    // suggested amount that the generic "Spendenbasis" would swallow.
    label: 'Beitrag',
    value: next?.costBasis || 'Spendenbasis',
    sub: 'Jeder gibt, was für ihn machbar ist',
  },
];

/**
 * The questions that come up between "this sounds interesting" and actually
 * turning up: when, where, how much, how do I sign up, can I come alone.
 *
 * Deliberately disjoint from the home page's FAQ set (src/content/home.json),
 * which answers what a Männerkreis is, whether you have to talk, how
 * confidentiality works and why it is not therapy.
 *
 * The first answer is the only one that depends on live data, which is exactly
 * why this is a function.
 */
export const buildEventFaq = (next: NextEventSummary | null): FaqEntry[] => [
  {
    question: 'Wann findet der nächste Männerkreis statt?',
    answer: next
      ? `Der nächste Termin ist ${next.dateLabel}${next.timeRange ? ` um ${next.timeRange}` : ''} in ${next.place}. Alle Details und die Anmeldung findest du auf der Seite zu diesem Termin.`
      : 'Der nächste Termin steht noch nicht fest. Sobald er geplant ist, erfährst du es über die Benachrichtigung auf dieser Seite oder über die WhatsApp-Gruppe.',
  },
  {
    question: 'Wie melde ich mich an?',
    answer:
      'Über das Anmeldeformular auf der Seite des jeweiligen Termins. Du brauchst nur Vor- und Nachnamen und eine E-Mail-Adresse. Danach bekommst du eine Bestätigung per E-Mail mit dem genauen Treffpunkt. Ist ein Abend ausgebucht, kommst du auf die Warteliste und rückst nach, sobald ein Platz frei wird.',
  },
  {
    question: 'Was kostet die Teilnahme?',
    answer: next?.costBasis
      ? `Für den nächsten Termin gilt: ${next.costBasis}. Du gibst, was dir der Abend wert ist und was für dich machbar ist – einen festen Preis oder eine Mitgliedschaft gibt es nicht.`
      : 'Der Kreis läuft auf Spendenbasis. Du gibst, was dir der Abend wert ist und was für dich machbar ist. Es gibt keinen festen Preis und keine Mitgliedschaft.',
  },
  {
    question: 'Wo genau findet der Männerkreis statt?',
    answer: `Der Männerkreis findet in ${next?.place || site.geo.locality} in Niederbayern statt. Die genaue Adresse bekommst du mit der Anmeldebestätigung – so bleibt der Ort der Gruppe vorbehalten, die tatsächlich zusammenkommt.`,
  },
  {
    question: 'Kann ich alleine kommen?',
    answer:
      'Ja. Du musst vorher niemanden kennen. Es reicht, wenn du dich für einen Termin anmeldest und an dem Abend da bist.',
  },
  {
    question: 'Gibt es Atemübungen oder Meditation?',
    answer:
      'Je nach Abend kann eine einfache Übung mit Atem, Körperwahrnehmung oder Stille dazugehören. Sie wird vorher erklärt, bleibt bodenständig, und du entscheidest selbst, woran du teilnimmst.',
  },
];
