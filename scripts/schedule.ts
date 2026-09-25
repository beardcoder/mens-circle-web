/**
 * The one scheduler entrypoint — every recurring task and its cadence lives
 * here, Laravel-`Kernel::schedule()`-style: the host (Coolify's "Scheduled
 * Task") calls this file every minute via cron, and it runs only the tasks
 * that are due on that minute. There is no in-process timer and nothing
 * loaded via `bun --preload` anymore — see CLAUDE.md's "Cron" section for why
 * that design was replaced.
 *
 *   docker exec <web-container> bun run scripts/schedule.ts
 *
 * Configure exactly that command in Coolify as a Scheduled Task on
 * `* * * * *`. Each task below still only fires on its own cadence; the
 * one-minute host tick just decides how fine that cadence can be.
 *
 * A task's own idempotency is what actually guards against a double run
 * (`runReminders()` stamps `reminder_sent_at`), not this file — so a missed
 * or doubled minute here is harmless by construction, not by care taken here.
 *
 * Tasks run sequentially, not in parallel: `bun:sqlite` is a single-writer
 * connection (see CLAUDE.md), and there's no reason two of these should ever
 * race each other. One task's failure is logged and does not stop the rest.
 */
import { backupConfigured, runBackup } from './backup-db';
import { isDue } from './lib/cron';
import { runReminders } from '../src/lib/server/reminders';

interface ScheduledTask {
  name: string;
  /** 5-field cron expression, evaluated on the UTC clock. */
  cron: string;
  run: () => Promise<void>;
}

const tasks: ScheduledTask[] = [
  {
    name: 'reminders',
    cron: '*/15 * * * *',
    run: runReminders,
  },
  // Cadence is a default, not a measured requirement — adjust freely.
  // Skipped entirely when BACKUP_S3_* isn't configured (see backupConfigured()),
  // the same "inert without its env" pattern listmonkConfigured() follows.
  ...(backupConfigured() ? [{ name: 'backup', cron: '0 3 * * *', run: runBackup } satisfies ScheduledTask] : []),
];

async function runDueTasks(at: Date): Promise<void> {
  const due = tasks.filter((task) => isDue(task.cron, at));
  if (due.length === 0) return;

  for (const task of due) {
    console.log(`[schedule] running ${task.name}`);
    try {
      await task.run();
    } catch (err) {
      console.error(`[schedule] ${task.name} failed`, err);
      process.exitCode = 1;
    }
  }
}

if (import.meta.main) {
  await runDueTasks(new Date());
}
