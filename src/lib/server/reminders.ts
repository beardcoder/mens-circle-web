import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from './db';
import { events, participants, registrations } from './db/schema';
import { sendEventReminder } from './email';
import { toDate } from './format';

function createWindow() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today.getTime() + 86_400_000);
  return {
    from: today.toISOString(),
    to: new Date(tomorrow.getTime() + 86_400_000).toISOString(),
    isToday: (d: Date) => d.getTime() < tomorrow.getTime(),
    stamp: now.toISOString(),
  };
}

function queryPending(from: string, to: string) {
  return db
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
}

type PendingRow = Awaited<ReturnType<typeof queryPending>>[number];

async function dispatch(row: PendingRow, isToday: boolean, stamp: string) {
  await sendEventReminder(row.event, row.participant, isToday);
  await db
    .update(registrations)
    .set({
      reminderSentAt: stamp,
      // TODO: send SMS via a provider if a phone is present.
      smsReminderSentAt: row.participant.phone ? stamp : row.regSmsReminderSentAt,
    })
    .where(eq(registrations.id, row.regId));
}

export async function runReminders(): Promise<void> {
  const window = createWindow();
  const rows = await queryPending(window.from, window.to);

  for (const r of rows) {
    try {
      const date = toDate(r.event.eventDate);
      if (date) await dispatch(r, window.isToday(date), window.stamp);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[reminders] per-registration failed', r.regId, String(err));
    }
  }
}
