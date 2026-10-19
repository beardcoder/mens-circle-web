/** Run every minute by Coolify (`bun run scripts/schedule.ts`); all times are UTC. */
import { runReminders } from '../src/lib/server/reminders';
import { backupConfigured, runBackup } from './backup-db';

async function run(name: string, task: () => Promise<void>): Promise<void> {
  console.log(`[schedule] running ${name}`);

  try {
    await task();
  } catch (err) {
    console.error(`[schedule] ${name} failed`, err);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  const now = new Date();
  const minute = now.getUTCMinutes();

  if (minute % 15 === 0) await run('reminders', runReminders);

  if (minute === 0 && now.getUTCHours() === 3 && backupConfigured()) {
    await run('backup', runBackup);
  }
}
