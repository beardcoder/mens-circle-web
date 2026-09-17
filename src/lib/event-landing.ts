/**
 * Content helpers for the date pages. Outside the components because /event both
 * renders these strings and emits some as FAQPage JSON-LD — Google flags FAQ
 * markup that does not match the visible text, so both read one source.
 *
 * Server-render only — it imports lib/server/format.
 */
import type { EventDTO } from './types';
import { formatDayMonthYearDE, formatWeekdayDE } from './server/format';
import site from '../data/site.json';

export interface FaqEntry {
  question: string;
  answer: string;
}

/** The upcoming event reduced to the strings the landing page shows. */
export interface NextEventSummary {
  slug: string;
  /** "Donnerstag, 18. September 2026" */
  dateLabel: string;
  /** "19:00–21:30 Uhr", or empty when no time is set. */
  timeRange: string;
  /** City, then venue name, then the site's own locality. */
  place: string;
  /** Free-text participation fee, empty when not set. */
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
 * Quick-scan facts. A scheduled event overrides what it knows: city, time
 * window, fee. Never more precise than the city — the exact address goes out
 * with the registration confirmation only.
 */
export const buildEventFacts = (next: NextEventSummary | null): EventFact[] => [
  {
    label: 'Wo',
    value: next?.place || site.geo.locality,
    sub: 'Die genaue Adresse bekommst du mit der Anmeldung',
  },
  {
    label: 'Wie oft',
    // Non-breaking space: the only acceptable break is before "Wochen" — between
    // the 2 and the 4 it reads as a stray hyphen.
    value: 'Alle\u00A02–4 Wochen',
    sub: 'Ein fester Rhythmus, keine Mitgliedschaft',
  },
  {
    label: 'Dauer',
    value: '2–3 Stunden',
    sub: next?.timeRange ? `Nächster Termin: ${next.timeRange}` : 'Ein Abend, kein Wochenendseminar',
  },
  {
    // The event's own fee text wins: it may name an amount "Spendenbasis" swallows.
    label: 'Beitrag',
    value: next?.costBasis || 'Spendenbasis',
    sub: 'Jeder gibt, was für ihn machbar ist',
  },
];

/**
 * The questions asked right before signing up. Deliberately disjoint from the
 * home page's FAQ set (src/content/home.json): two FAQPage blocks asking the
 * same questions on two URLs only compete.
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
