/** The next-date state and the one view every event summary renders; `unavailable` must never read as "no date planned". */

import site from '../data/site.json';
import { eventPlace } from './event-meta';
import { formatDayMonthYearDE, formatWeekdayDE, isoDay, timeRange } from './server/format';
import type { EventDTO } from './types';

export type NextEventStatus = 'scheduled' | 'none' | 'unavailable';

/** The upcoming event reduced to the strings the pages show. */
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

const summarizeNextEvent = (event: EventDTO | null): NextEventSummary | null =>
  event && {
    slug: event.slug,
    dateLabel: [formatWeekdayDE(event.event_date), formatDayMonthYearDE(event.event_date)].filter(Boolean).join(', '),
    timeRange: timeRange(event.start_time, event.end_time),
    place: eventPlace(event),
    costBasis: event.cost_basis?.trim() ?? '',
    isFull: event.is_full,
    availableSpots: event.available_spots,
    maxParticipants: event.max_participants,
  };

export interface DateStatus {
  status: NextEventStatus;
  next: NextEventSummary | null;
  isFull: boolean;
}

export const dateStatus = (status: NextEventStatus, event: EventDTO | null): DateStatus => {
  const next = status === 'scheduled' ? summarizeNextEvent(event) : null;

  return { status, next, isFull: Boolean(next?.isFull) };
};

/**
 * A fee as a short main value and a note: "Auf Spendenbasis (Empfehlung 15–25 €)"
 * becomes "Auf Spendenbasis" and "Empfehlung 15–25 €", so a long fee never blows
 * up a row of facts. Without a fee: the circle's standing rule.
 */
export const splitFee = (costBasis = ''): { main: string; note: string } => {
  const fee = costBasis.trim();

  if (!fee) return { main: 'Spendenbasis', note: 'Du gibst, was für dich machbar ist' };

  const bracketed = /^(.+?)\s*\((.+)\)\s*$/.exec(fee);

  if (bracketed) return { main: bracketed[1].trim(), note: bracketed[2].trim() };

  const parted = /^(.{4,28}?)\s*[,;–]\s+(.+)$/.exec(fee);

  if (parted) return { main: parted[1].trim(), note: parted[2].trim() };

  return { main: fee, note: '' };
};

/** One row of an event summary: a term and its value, each one line. */
interface SummaryRow {
  label: string;
  value: string;
}

/**
 * Everything an event summary shows, in every state. Scheduled and past dates
 * name time, place, fee and seats; the other states keep the same four rows with
 * what is always true (rhythm, place, fee), so every state stands the same height.
 */
export interface SummaryView {
  state: 'open' | 'full' | 'past' | 'none' | 'unavailable';
  /** The label above the date: "Nächster Termin", "Termin", … */
  kicker: string;
  /** Two fixed lines: the weekday and the date ("Freitag," / "16. Oktober 2026"), or the state in words. */
  title: [string, string];
  /** ISO day for `<time>`, when the title is a date. */
  datetime: string;
  rows: SummaryRow[];
  /** The situational action; `null` where the page already offers it. */
  action: { label: string; href: string } | null;
}

/** "Freitag, 16. Oktober 2026" → ["Freitag,", "16. Oktober 2026"]. */
const dateLines = (dateLabel: string): [string, string] => {
  const [weekday, ...rest] = dateLabel.split(', ');

  return rest.length ? [`${weekday},`, rest.join(', ')] : [dateLabel, ''];
};

const RHYTHM_ROWS = (place = site.geo.locality): SummaryRow[] => [
  { label: 'Rhythmus', value: 'Alle 2–4 Wochen' },
  { label: 'Ort', value: place },
  { label: 'Beitrag', value: 'Auf Spendenbasis' },
];

const seatsText = (event: { isFull: boolean; availableSpots: number; maxParticipants: number }): string =>
  event.isFull ? 'Ausgebucht · Warteliste' : `${event.availableSpots} von ${event.maxParticipants} Plätzen frei`;

const OVERVIEW = { label: 'Termine ansehen', href: '/event' };

/** No date to show: none planned, or none readable. The rows keep what is always true. */
const noDateView = (unavailable: boolean, whenNone: 'overview' | 'notify', kicker: string): SummaryView => ({
  state: unavailable ? 'unavailable' : 'none',
  kicker,
  title: unavailable ? ['Termine gerade', 'nicht abrufbar'] : ['Zurzeit kein', 'Termin geplant'],
  datetime: '',
  rows: [...RHYTHM_ROWS(), { label: 'Status', value: unavailable ? 'Siehe Terminseite' : 'Neuer Termin folgt' }],
  action:
    unavailable || whenNone === 'overview' ? OVERVIEW : { label: 'Termine per E-Mail erhalten', href: '#newsletter' },
});

/**
 * The summary of the next date, for the home page: its action points to the event;
 * with none planned to the overview (`overview`, the hero) or to the e-mail
 * notification (`notify`, beside the form).
 */
export const nextDateView = (
  state: DateStatus,
  whenNone: 'overview' | 'notify' = 'overview',
  kicker = 'Nächster Termin',
): SummaryView => {
  const { status, next } = state;

  if (status === 'unavailable' || !next) return noDateView(status === 'unavailable', whenNone, kicker);

  return {
    state: next.isFull ? 'full' : 'open',
    kicker,
    title: dateLines(next.dateLabel),
    datetime: next.slug,
    rows: [
      { label: 'Zeit', value: next.timeRange || 'Abends' },
      { label: 'Ort', value: next.place },
      { label: 'Beitrag', value: splitFee(next.costBasis).main },
      { label: 'Plätze', value: seatsText(next) },
    ],
    action: { label: next.isFull ? 'Auf die Warteliste' : 'Zum nächsten Termin', href: `/event/${next.slug}` },
  };
};

/** The summary of one event, as listed on /event or opening its own page. */
export const eventView = (event: EventDTO, kicker: string, withAction = true): SummaryView => {
  const next = summarizeNextEvent(event)!;
  const state = event.is_past ? 'past' : event.is_full ? 'full' : 'open';

  return {
    state,
    kicker: state === 'full' ? `${kicker} · ausgebucht` : kicker,
    title: dateLines(next.dateLabel),
    datetime: isoDay(event.event_date),
    rows: [
      { label: 'Zeit', value: next.timeRange || 'Abends' },
      { label: 'Ort', value: next.place },
      { label: 'Beitrag', value: splitFee(next.costBasis).main },
      {
        label: 'Plätze',
        value: event.is_past ? 'Hat stattgefunden' : seatsText(next),
      },
    ],
    action:
      withAction && !event.is_past
        ? { label: event.is_full ? 'Auf die Warteliste' : 'Zur Anmeldung', href: `/event/${event.slug}` }
        : null,
  };
};
