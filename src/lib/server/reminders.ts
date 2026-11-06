import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';

import { settleWithConcurrency } from './concurrency';
import { db } from './db';
import { ACTIVE_REGISTRATION_STATUSES, events, participants, registrations } from './db/schema';
import { sendEventReminder } from './email';
import { candidateDays, reminderDue } from './reminder-window';

type PendingRow = Awaited<ReturnType<typeof queryPending>>[number];

/** Unreminded seats of public events on the given days ("YYYY-MM-DD", `to` exclusive). */
const queryPending = (from: string, to: string) =>
  db
    .select({
      regId: registrations.id,
      event: events,
      participant: participants,
    })
    .from(registrations)
    .innerJoin(events, eq(registrations.eventId, events.id))
    .innerJoin(participants, eq(registrations.participantId, participants.id))
    .where(
      and(
        isNull(registrations.deleted),
        isNull(registrations.reminderSentAt),
        eq(events.isPublished, true),
        isNull(events.deleted),
        gte(events.eventDate, from),
        lt(events.eventDate, to),
        inArray(registrations.status, ACTIVE_REGISTRATION_STATUSES),
      ),
    )
    .orderBy(asc(registrations.registeredAt));

const dispatch = async (row: PendingRow, now: Date) => {
  const kind = reminderDue(row.event.eventDate, row.event.startTime, now);

  if (!kind) return;

  const accepted = await sendEventReminder(row.event, row.participant, kind === 'today', row.regId);

  if (!accepted) return;

  await db.update(registrations).set({ reminderSentAt: now.toISOString() }).where(eq(registrations.id, row.regId));
};

/** One idempotent pass: every seat whose event is in a reminder window (reminder-window.ts) and has none yet. */
export async function runReminders(now: Date = new Date()): Promise<void> {
  const { from, to } = candidateDays(now);
  const rows = await queryPending(from, to);
  const results = await settleWithConcurrency(rows, (row) => dispatch(row, now));

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      // eslint-disable-next-line no-console
      console.error('[reminders] failed', rows[i].regId, result.reason);
    }
  }
}
