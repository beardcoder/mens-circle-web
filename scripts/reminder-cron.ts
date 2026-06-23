/**
 * Event-reminder scheduler — Bun's native in-process cron.
 *
 * Loaded via `bun --preload` from docker-entrypoint.sh, so it registers exactly
 * once at process startup, before the Astro server entry boots, inside the same
 * long-lived web process. This is the deterministic startup hook the published
 * Bun adapter doesn't give us on its own (the old lazy "start from middleware"
 * trick relied on a runtime flag the new adapter never sets).
 *
 * `Bun.cron` schedules in UTC and guarantees no overlap: the next fire is only
 * computed after the handler settles, so a slow pass can never stack up. A
 * rejected handler would surface as an unhandledRejection (process exit 1), so
 * we swallow errors here — one bad pass must not take the web server down. Bun
 * reschedules the job after the handler returns either way.
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
