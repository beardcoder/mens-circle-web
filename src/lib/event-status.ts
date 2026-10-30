/**
 * The next-date state and the one view every event summary renders; `unavailable` must
 * never read as "no date planned".
 */

import { eventPlace } from './event-meta';
import { formatDateLongDE, isoDay, timeRange } from './server/format';
import type { EventDTO } from './types';

export type NextEventStatus = 'scheduled' | 'none' | 'unavailable';

/** The upcoming event reduced to the strings the pages show. */
interface NextEventSummary {
  slug: string;
  /** ISO day for `<time>`. */
  day: string;
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
    day: isoDay(event.event_date),
    dateLabel: formatDateLongDE(event.event_date),
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
}

export const dateStatus = (status: NextEventStatus, event: EventDTO | null): DateStatus => {
  const next = status === 'scheduled' ? summarizeNextEvent(event) : null;

  return { status, next };
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

/** One row of an event summary: a term and its value, wrapping when needed. */
interface SummaryRow {
  label: string;
  value: string;
}

/**
 * Everything an event summary shows, in every state. Scheduled and past dates
 * name time, place, fee and seats in the same four rows. Empty and error states
 * are rendered separately by EventAvailability.
 */
export interface SummaryView {
  state: 'open' | 'full' | 'past';
  /** The label above the date: "Nächster Termin", "Termin", … */
  kicker: string;
  /** Two fixed lines: the weekday and the date ("Freitag," / "16. Oktober 2026"), or the state in words. */
  title: [string, string];
  /** ISO day for `<time>`, when the title is a date. */
  datetime: string;
  rows: SummaryRow[];
  /** The circle's seats, drawn around the date; `null` once the evening is past. */
  seats: { total: number; free: number } | null;
  /** The situational action; `null` where the page already offers it. */
  action: { label: string; href: string } | null;
}

/** "Freitag, 16. Oktober 2026" → ["Freitag,", "16. Oktober 2026"]. */
const dateLines = (dateLabel: string): [string, string] => {
  const [weekday, ...rest] = dateLabel.split(', ');

  return rest.length ? [`${weekday},`, rest.join(', ')] : [dateLabel, ''];
};

const seatsText = (event: NextEventSummary): string =>
  event.isFull ? 'Ausgebucht · Warteliste' : `${event.availableSpots} von ${event.maxParticipants} Plätzen frei`;

/** Time, place, fee and seats: the four rows of a dated summary. */
const dateRows = (next: NextEventSummary, seats = seatsText(next)): SummaryRow[] => [
  { label: 'Zeit', value: next.timeRange || 'Abends' },
  { label: 'Ort', value: next.place },
  { label: 'Beitrag', value: splitFee(next.costBasis).main },
  { label: 'Plätze', value: seats },
];

/** The summary of one event, as listed on /event or opening its own page. */
export const eventView = (event: EventDTO, kicker: string, withAction = true): SummaryView => {
  const next = summarizeNextEvent(event)!;
  const state = event.is_past ? 'past' : event.is_full ? 'full' : 'open';

  return {
    state,
    kicker: state === 'full' ? `${kicker} · ausgebucht` : kicker,
    title: dateLines(next.dateLabel),
    datetime: next.day,
    rows: dateRows(next, event.is_past ? 'Hat stattgefunden' : undefined),
    seats: event.is_past
      ? null
      : { total: next.maxParticipants, free: event.is_full ? 0 : Math.max(0, next.availableSpots) },
    action:
      withAction && !event.is_past
        ? { label: event.is_full ? 'Auf die Warteliste' : 'Zur Anmeldung', href: `/event/${event.slug}` }
        : null,
  };
};
