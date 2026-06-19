/**
 * Event reminder scheduler (server-only). Replaces the PocketBase cron.
 *
 * Runs every 15 minutes inside the long-lived Bun server: finds active,
 * not-yet-reminded registrations whose published event falls today or tomorrow,
 * sends the heute/morgen reminder and stamps `reminder_sent_at` (idempotent).
 *
 * Started lazily from the middleware on the first request (guarded by a global
 * flag), so it lives for the lifetime of the process without a separate boot
 * hook in the adapter entry.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { events, participants, registrations } from './db/schema';
import { sendEventReminder } from './email';
import { toDate } from './format';

const INTERVAL_MS = 15 * 60 * 1000;

// Module-level guard: a single interval per process.
const globalForCron = globalThis as unknown as { __mcReminderStarted?: boolean };

async function runReminders(): Promise<void> {
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

      const nowIso = new Date().toISOString();
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
      console.error('[cron] reminder per-registration failed', r.regId, String(err));
    }
  }
}

/** Start the reminder interval once per process. Safe to call repeatedly. */
export function startReminderCron(): void {
  if (globalForCron.__mcReminderStarted) return;
  globalForCron.__mcReminderStarted = true;
  // Run shortly after boot, then on the interval.
  const onFail = (e: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[cron] reminders failed', String(e));
  };
  setTimeout(() => void runReminders().catch(onFail), 30_000);
  setInterval(() => void runReminders().catch(onFail), INTERVAL_MS);
  // eslint-disable-next-line no-console
  console.log('[cron] event-reminder scheduler started (every 15m)');
}
