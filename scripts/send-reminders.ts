/** One idempotent reminder pass, then exit — the manual escape hatch beside the scheduled pass in scripts/schedule.ts. */
import { runReminders } from '../src/lib/server/reminders';

try {
  await runReminders();
  process.exit(0);
} catch (err) {
  console.error('[reminders] run failed', err);
  process.exit(1);
}
