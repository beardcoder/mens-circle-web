/**
 * Event-reminder job — ported from `cron.pb.js`. Finds active registrations
 * whose published event falls today or tomorrow and hasn't been reminded yet,
 * emits a `reminder.due` event (→ reminder email) and stamps `reminder_sent_at`
 * so it's idempotent. Runs both from the in-process interval and the protected
 * HTTP endpoint, so it's host-agnostic (a Cloudflare Cron Trigger can call it).
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import type { DB } from '../db';
import { participants, registrations } from '../db/schema';
import type { Notifier } from '../notifications';
import type { EventService } from './events';

const toMailParticipant = (p: typeof participants.$inferSelect) => ({
  firstName: p.firstName,
  lastName: p.lastName,
  email: p.email,
  phone: p.phone,
});

export function createReminderService(
  db: DB,
  events: EventService,
  notifier: Notifier,
) {
  async function runDue(): Promise<number> {
    const now = new Date();
    const startOfToday = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
    );
    const endOfTomorrow = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      23,
      59,
      59,
    );

    const regs = await db
      .select()
      .from(registrations)
      .where(
        and(
          or(
            eq(registrations.status, 'registered'),
            eq(registrations.status, 'attended'),
          ),
          isNull(registrations.deleted),
          isNull(registrations.reminderSentAt),
        ),
      )
      .limit(500);

    let sent = 0;
    for (const reg of regs) {
      try {
        const event = await events.getById(reg.event);
        if (!event) continue;
        if (!event.isPublished || event.deleted != null) continue;

        const t = event.eventDate.getTime();
        if (t < startOfToday || t > endOfTomorrow) continue;

        const isToday =
          event.eventDate.getUTCFullYear() === now.getUTCFullYear() &&
          event.eventDate.getUTCMonth() === now.getUTCMonth() &&
          event.eventDate.getUTCDate() === now.getUTCDate();

        const p = await db
          .select()
          .from(participants)
          .where(eq(participants.id, reg.participant))
          .limit(1);
        if (!p[0]) continue;

        await notifier.emit({
          type: 'reminder.due',
          event,
          participant: toMailParticipant(p[0]),
          isToday,
        });

        const stamp = new Date();
        await db
          .update(registrations)
          .set({
            reminderSentAt: stamp,
            // TODO: actually send the SMS via a provider when a phone is present.
            ...(p[0].phone ? { smsReminderSentAt: stamp } : {}),
            updated: stamp,
          })
          .where(eq(registrations.id, reg.id));
        sent += 1;
      } catch (err) {
        console.error(
          '[reminders] per-registration failed',
          reg.id,
          String(err),
        );
      }
    }
    return sent;
  }

  return { runDue };
}

export type ReminderService = ReturnType<typeof createReminderService>;
