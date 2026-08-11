/**
 * Event-reminder scheduler — Bun's native in-process cron.
 *
 * Loaded via `bun --preload` from docker-entrypoint.sh, so it registers once at
 * process startup, before the Astro entry boots, in the same long-lived web
 * process — the deterministic startup hook the Bun adapter doesn't offer.
 *
 * `Bun.cron` schedules in UTC and computes the next fire only after the handler
 * settles, so a slow pass cannot stack up. Errors are swallowed here because a
 * rejected handler would exit the process and take the web server with it.
 */
import { runReminders } from '../src/lib/server/reminders';

Bun.cron('*/15 * * * *', async () => {
  try {
    await runReminders();
  } catch (err) {
    console.error('[reminders] cron pass failed', err);
  }
});

console.log('[reminders] cron registered (*/15 * * * *, UTC)');
