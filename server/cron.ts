/**
 * EmDash — Background cron tasks (event reminders).
 *
 * Replaces the PocketBase cron hook. Runs every 15 minutes via setInterval.
 */
import { getDb, nowISO } from './db.ts';
import {
  toDate,
  sendMail,
  renderEventReminder,
  type EventRow,
  type ParticipantRow,
} from './lib.ts';

export function startCron(): void {
  // Run immediately on boot, then every 15 minutes.
  void runReminders();
  setInterval(() => void runReminders(), 15 * 60 * 1000);
  console.log('→ Cron: event reminders scheduled (every 15 min)');
}

async function runReminders(): Promise<void> {
  try {
    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
      ),
    );
    const endOfTomorrow = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        23,
        59,
        59,
      ),
    );

    const startISO = startOfToday
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '');
    const endISO = endOfTomorrow
      .toISOString()
      .replace('T', ' ')
      .replace('Z', '');

    // Find registrations needing reminders
    const regs = db
      .query(
        `SELECT r.*, e.event_date, e.title as event_title, e.is_published, e.deleted_at as event_deleted
         FROM registrations r
         JOIN events e ON e.id = r.event_id
         WHERE (r.status = 'registered' OR r.status = 'attended')
           AND r.deleted_at IS NULL
           AND r.reminder_sent_at IS NULL
           AND e.is_published = 1
           AND e.deleted_at IS NULL
           AND e.event_date >= ?
           AND e.event_date <= ?
         LIMIT 500`,
      )
      .all(startISO, endISO) as Array<{
      id: string;
      participant_id: string;
      event_id: string;
      event_date: string;
    }>;

    for (const reg of regs) {
      try {
        const event = db
          .query('SELECT * FROM events WHERE id = ?')
          .get(reg.event_id) as EventRow | null;
        if (!event) continue;

        const eventDate = toDate(event.event_date);
        if (!eventDate) continue;

        const isToday =
          eventDate.getUTCFullYear() === startOfToday.getUTCFullYear() &&
          eventDate.getUTCMonth() === startOfToday.getUTCMonth() &&
          eventDate.getUTCDate() === startOfToday.getUTCDate();

        const participant = db
          .query('SELECT * FROM participants WHERE id = ?')
          .get(reg.participant_id) as ParticipantRow | null;
        if (!participant) continue;

        const tpl = renderEventReminder(event, participant, isToday);
        await sendMail({ to: participant.email, ...tpl });

        const nowStr = nowISO();
        db.query(
          'UPDATE registrations SET reminder_sent_at = ?, updated_at = ? WHERE id = ?',
        ).run(nowStr, nowStr, reg.id);
      } catch (regErr) {
        console.error(
          `[cron] reminder failed for reg ${reg.id}:`,
          String(regErr),
        );
      }
    }
  } catch (err) {
    console.error('[cron] event-reminders failed:', String(err));
  }
}
