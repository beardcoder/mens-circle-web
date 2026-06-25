import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from './db';
import { events, participants, registrations } from './db/schema';
import { sendEventReminder } from './email';
import { toDate } from './format';

type Window = ReturnType<typeof createWindow>;
type PendingRow = Awaited<ReturnType<typeof queryPending>>[number];

const createWindow = () => {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today.getTime() + 86_400_000);
  return {
    from: today.toISOString(),
    to: new Date(tomorrow.getTime() + 86_400_000).toISOString(),
    isToday: (d: Date) => d.getTime() < tomorrow.getTime(),
    stamp: now.toISOString(),
  } as const;
};

const queryPending = (from: string, to: string) =>
  db
    .select({
      regId: registrations.id,
      regSmsReminderSentAt: registrations.smsReminderSentAt,
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
        inArray(registrations.status, ['registered', 'attended']),
      ),
    )
    .orderBy(asc(registrations.registeredAt));

const dispatch = async (row: PendingRow, { isToday, stamp }: Window) => {
  const date = toDate(row.event.eventDate);
  if (!date) return;

  await sendEventReminder(row.event, row.participant, isToday(date));
  await db
    .update(registrations)
    .set({
      reminderSentAt: stamp,
      // TODO: send SMS via a provider if a phone is present.
      smsReminderSentAt: row.participant.phone ? stamp : row.regSmsReminderSentAt,
    })
    .where(eq(registrations.id, row.regId));
};

export async function runReminders(): Promise<void> {
  const win = createWindow();
  const rows = await queryPending(win.from, win.to);
  const results = await Promise.allSettled(rows.map((r) => dispatch(r, win)));

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      // eslint-disable-next-line no-console
      console.error('[reminders] failed', rows[i].regId, result.reason);
    }
  }
}
