/**
 * Run every minute by Coolify (`bun run scripts/schedule.ts`); all times are UTC.
 * The checks come first and the task modules load only when one is due: importing
 * the server lib opens the database and runs the migrations, which most minutes
 * have no reason to do.
 */
interface Task {
  name: string;
  run: () => Promise<unknown>;
}

/** What is due at `now`, in the order it runs. */
export function dueTasks(now: Date, backupEnabled: () => boolean): Task[] {
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const tasks: Task[] = [];

  if (minute % 15 === 0) {
    tasks.push({ name: 'reminders', run: async () => (await import('../src/lib/server/reminders')).runReminders() });
  }

  // Before the backup, so tonight's copy already lacks what expired.
  if (minute === 30 && hour === 2) {
    tasks.push({ name: 'retention', run: async () => (await import('../src/lib/server/retention')).runRetention() });
  }

  if (minute === 0 && hour === 3 && backupEnabled()) {
    tasks.push({ name: 'backup', run: async () => (await import('./backup-db')).runBackup() });
  }

  return tasks;
}

async function run({ name, run: task }: Task): Promise<void> {
  console.log(`[schedule] running ${name}`);

  try {
    await task();
  } catch (err) {
    console.error(`[schedule] ${name} failed`, err);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await (await import('../src/lib/server/run-as')).runAsAppUser();

  const { backupConfigured } = await import('./backup-db');

  for (const task of dueTasks(new Date(), backupConfigured)) await run(task);
}
