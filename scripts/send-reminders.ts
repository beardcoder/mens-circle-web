/**
 * One-shot event-reminder run.
 *
 * The scheduled pass runs in-process via Bun.cron (scripts/reminder-cron.ts,
 * loaded with `bun --preload` — see docker-entrypoint.sh). This script is the
 * manual escape hatch: one idempotent pass, then exit. Useful to force a pass
 * after fixing a mail misconfiguration without waiting for the next tick.
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
