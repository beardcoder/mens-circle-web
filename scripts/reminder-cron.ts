/**
 * Event-reminder scheduler — in-process, every 15 minutes on the UTC quarter hour.
 *
 * Loaded via `bun --preload` from docker-entrypoint.sh, so it registers once at
 * process startup, before the Astro entry boots, in the same long-lived web
 * process — the deterministic startup hook the Bun adapter doesn't offer.
 *
 * Deliberately plain timers, NOT `Bun.cron`: the runtime's `Bun.cron` is the
 * OS-level `(path, schedule, title)` form, which writes to the host crontab —
 * there is no cron daemon in the image, and the in-process callback overload
 * that `@types/bun` declares does not exist at runtime, so it type-checks and
 * then throws at boot, killing the preload and with it the whole server.
 *
 * The next pass is scheduled only after the current one settles, so a slow pass
 * cannot stack up. Errors are caught here because an unhandled rejection would
 * exit the process and take the web server with it. The timer is unref'd: the
 * HTTP server owns the process lifetime, not this loop.
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
