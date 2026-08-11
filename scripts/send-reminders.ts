/**
 * One-shot event-reminder run — the manual escape hatch beside the scheduled
 * pass in scripts/reminder-cron.ts. One idempotent pass, then exit.
 *
 *   bun run scripts/send-reminders.ts
 *   docker exec <web> bun run scripts/send-reminders.ts
 *
 * Reads the same env as the server (DATABASE_PATH, LISTMONK_*, APP_URL, …).
 */
import { runReminders } from '../src/lib/server/reminders';

try {
  await runReminders();
  process.exit(0);
} catch (err) {
  console.error('[reminders] run failed', err);
  process.exit(1);
}
