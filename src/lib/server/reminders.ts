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
import { and, asc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from './db';
import { events, participants, registrations } from './db/schema';
import { sendEventReminder } from './email';
import { toDate } from './format';

export async function runReminders(): Promise<void> {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);
  const startOfDayAfter = new Date(startOfTomorrow.getTime() + 86_400_000);

  const rows = await db
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
        gte(events.eventDate, startOfToday.toISOString()),
        lt(events.eventDate, startOfDayAfter.toISOString()),
        inArray(registrations.status, ['registered', 'attended']),
      ),
    )
    .orderBy(asc(registrations.registeredAt));

  const nowIso = now.toISOString();
  for (const r of rows) {
    try {
      const eventDate = toDate(r.event.eventDate);
      if (!eventDate) continue;

      const isToday = eventDate.getTime() < startOfTomorrow.getTime();

      await sendEventReminder(r.event, r.participant, isToday);

      await db
        .update(registrations)
        .set({
          reminderSentAt: nowIso,
          // TODO: send SMS via a provider if a phone is present.
          smsReminderSentAt: r.participant.phone ? nowIso : r.regSmsReminderSentAt,
        })
        .where(eq(registrations.id, r.regId));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[reminders] per-registration failed', r.regId, String(err));
    }
  }
}
