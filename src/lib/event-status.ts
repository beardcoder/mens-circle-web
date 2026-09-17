/**
 * Maps "is a date on the books?" to what every surface says and offers — the
 * header, the home hero, the closing Termine block, /event and /event/<slug>
 * all read this one object.
 *
 * Three states, deliberately, not two:
 *   scheduled    — a published, upcoming event exists
 *   none         — nothing is scheduled (a true, sayable fact)
 *   unavailable  — the read failed; we do not know, and must not claim we do
 */

import type { NextEventSummary } from './event-landing';

export type NextEventStatus = 'scheduled' | 'none' | 'unavailable';

export interface DateStatus {
  status: NextEventStatus;
  next: NextEventSummary | null;
  isFull: boolean;
}

export const dateStatus = (status: NextEventStatus, next: NextEventSummary | null): DateStatus => ({
  status,
  next: status === 'scheduled' ? next : null,
  isFull: status === 'scheduled' ? Boolean(next?.isFull) : false,
});

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
