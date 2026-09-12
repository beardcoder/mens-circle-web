/**
 * The one place that turns "is there a date on the books?" into what the page
 * actually says and offers.
 *
 * The header, the home page hero and the closing Termine block, /event and
 * /event/<slug> all have to agree — a hero promising "Platz sichern" over a
 * landing page saying "noch kein Termin" is the kind of contradiction that
 * costs trust. So the mapping from state to (line of text, primary action)
 * lives here, once, and every surface reads it.
 *
 * Three states, deliberately, not two:
 *   scheduled    — a published, upcoming event exists
 *   none         — nothing is scheduled (a true, sayable fact)
 *   unavailable  — the read failed; we do not know, and must not claim we do
 *
 * Server-render only: it imports the DB-facing summary type.
 */

import type { NextEventSummary } from './event-landing';

export type NextEventStatus = 'scheduled' | 'none' | 'unavailable';

export interface DateStatus {
  status: NextEventStatus;
  /** The upcoming event's display strings, or null in the other two states. */
  next: NextEventSummary | null;
  /** True only when a date exists and every seat is taken. */
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
  /**
   * A short line of orientation shown above the action. Never a claim we cannot
   * back: with no date it says so, and when the read failed it says *that*
   * instead of inventing an empty calendar.
   */
  note: string;
}

/**
 * The single primary action for a page, given the scheduling state.
 *
 * `fallbackHref` is where "get notified" points — the home page has that block
 * on the same page (`#termine`), /event has its own.
 */
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
      // No "nur noch wenige Plätze" anywhere: when it is full, it is full, and
      // when it is not, the exact number is shown rather than dressed up.
      note: `Der Termin am ${when} in ${next.place} ist ausgebucht.`,
    };
  }

  return {
    label: 'Zum Termin und anmelden',
    href: `/event/${next.slug}`,
    note: `Nächster Termin: ${when} in ${next.place}.`,
  };
};
