/**
 * One-shot event-reminder run.
 *
 * Invoked on a schedule by the `reminders` s6-overlay service in the Docker
 * image (every 15 minutes — see the Dockerfile), replacing the old in-process
 * setInterval cron. Does a single reminder pass and exits, so a failed run can
 * never wedge the long-lived web process.
 *
 *   bun run scripts/send-reminders.ts
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
