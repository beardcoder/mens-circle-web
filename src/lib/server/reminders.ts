/**
 * Event reminder run (server-only).
 *
 * Finds active, not-yet-reminded registrations whose published event falls today
 * or tomorrow, sends the heute/morgen reminder and stamps `reminder_sent_at`
 * (idempotent).
 *
 * This is a single, side-effect-free *pass*: it does the work once and returns.
 * It is scheduled in-process via `Bun.cron` (registered by `scripts/reminder-cron.ts`,
 * loaded via `bun --preload` in `docker-entrypoint.sh`). Call `runReminders()`
 * directly from `scripts/send-reminders.ts` for a manual one-shot trigger.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { events, participants, registrations } from './db/schema';
import { sendEventReminder } from './email';
import { toDate } from './format';

export async function runReminders(): Promise<void> {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const endOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59));

  const rows = await db
    .select({
      regId: registrations.id,
      regPhone: participants.phone,
      eventId: events.id,
      eventDate: events.eventDate,
      isPublished: events.isPublished,
      deleted: events.deleted,
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
      ),
    )
    .orderBy(asc(registrations.registeredAt));

  for (const r of rows) {
    try {
      // Status filter (registered | attended).
      const eventDate = toDate(r.eventDate);
      if (!eventDate) continue;
      if (eventDate.getTime() < startOfToday.getTime() || eventDate.getTime() > endOfTomorrow.getTime()) continue;

      // Re-read the full registration to check status (kept simple).
      const reg = (await db.select().from(registrations).where(eq(registrations.id, r.regId)).limit(1))[0];
      if (!reg || (reg.status !== 'registered' && reg.status !== 'attended')) continue;

      const event = (await db.select().from(events).where(eq(events.id, r.eventId)).limit(1))[0];
      const participant = (
        await db.select().from(participants).where(eq(participants.id, reg.participantId)).limit(1)
      )[0];
      if (!event || !participant) continue;

      const isToday =
        eventDate.getUTCFullYear() === startOfToday.getUTCFullYear() &&
        eventDate.getUTCMonth() === startOfToday.getUTCMonth() &&
        eventDate.getUTCDate() === startOfToday.getUTCDate();

      await sendEventReminder(event, participant, isToday);

      const nowIso = now.toISOString();
      await db
        .update(registrations)
        .set({
          reminderSentAt: nowIso,
          // TODO: send SMS via a provider if a phone is present.
          smsReminderSentAt: participant.phone ? nowIso : reg.smsReminderSentAt,
        })
        .where(eq(registrations.id, reg.id));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[reminders] per-registration failed', r.regId, String(err));
    }
  }
}
