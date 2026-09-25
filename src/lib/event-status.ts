/** The next-date state for every surface; `unavailable` must never read as "no date planned". */

import { eventPlace } from './event-meta';
import { formatDayMonthYearDE, formatWeekdayDE, timeRange } from './server/format';
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

export const summarizeNextEvent = (event: EventDTO | null): NextEventSummary | null =>
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

export interface PrimaryAction {
  label: string;
  href: string;
  /** Orientation shown above the action. Never a claim we cannot back: a failed
   *  read says so rather than inventing an empty calendar. */
  note: string;
}

/** `fallbackHref` is where "get notified" points; each page has its own block. */
export const primaryAction = (state: DateStatus, fallbackHref = '#termine'): PrimaryAction => {
  const { status, next, isFull } = state;

  if (status === 'unavailable') {
    return {
      label: 'Termine ansehen',
      href: '/event',
      note: 'Die Termine lassen sich gerade nicht laden. Auf der Terminseite steht der aktuelle Stand.',
    };
  }

  if (status === 'none' || !next) {
    return {
      label: 'Bei neuen Terminen benachrichtigen',
      href: fallbackHref,
      note: 'Zurzeit steht kein neuer Termin fest.',
    };
  }

  const when = [next.dateLabel, next.timeRange].filter(Boolean).join(', ');

  if (isFull) {
    return {
      label: 'Auf die Warteliste',
      href: `/event/${next.slug}`,
      note: `Der Termin am ${when} in ${next.place} ist ausgebucht.`,
    };
  }

  return {
    label: 'Zum Termin und anmelden',
    href: `/event/${next.slug}`,
    note: `Nächster Termin: ${when} in ${next.place}.`,
  };
};
