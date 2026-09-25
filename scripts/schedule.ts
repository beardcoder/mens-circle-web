/** Run every minute by Coolify (`bun run scripts/schedule.ts`); runs due tasks in sequence. */
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
