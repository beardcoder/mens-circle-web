/**
 * Event-reminder scheduler — in-process, every 15 minutes on the UTC quarter
 * hour. Loaded via `bun --preload` from docker-entrypoint.sh, so it registers
 * once at process startup, in the same long-lived web process.
 *
 * Plain timers, NOT `Bun.cron`: the runtime only implements the OS-level
 * `(path, schedule, title)` form, which writes to a crontab the image has no
 * daemon for. The in-process callback overload exists only in `@types/bun`, so
 * it type-checks and then throws at boot, killing the whole server.
 *
 * The next pass is scheduled only after the current one settles, so passes
 * cannot stack. The timer is unref'd: the HTTP server owns the process lifetime.
 */
import { runReminders } from '../src/lib/server/reminders';

const INTERVAL_MS = 15 * 60 * 1000;

/** Milliseconds until the next quarter-hour boundary on the UTC clock. */
function msUntilNextSlot(): number {
  return INTERVAL_MS - (Date.now() % INTERVAL_MS);
}

function schedule(delay: number): void {
  setTimeout(async () => {
    try {
      await runReminders();
    } catch (err) {
      console.error('[reminders] pass failed', err);
    }
    schedule(msUntilNextSlot());
  }, delay).unref();
}

schedule(msUntilNextSlot());

console.log('[reminders] scheduler registered (every 15 min, on the UTC quarter hour)');
