/**
 * POST|GET /api/internal/cron/reminders — runs the event-reminder job. Called by
 * the in-process scheduler (adapter/server.mjs) and usable by an external
 * scheduler (e.g. a Cloudflare Cron Trigger). Guarded by CRON_SECRET so it can't
 * be triggered publicly.
 */
import type { APIRoute } from 'astro';
import { config } from '../../../../server/config';
import { getServices } from '../../../../server/container';
import { json } from '../../../../server/http';

export const prerender = false;

function authorized(request: Request): boolean {
  if (!config.CRON_SECRET) return false;
  const header =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  return header === config.CRON_SECRET;
}

const handler: APIRoute = async ({ request }) => {
  if (!authorized(request)) return json(401, { ok: false });
  try {
    const { reminders } = getServices();
    const sent = await reminders.runDue();
    return json(200, { ok: true, sent });
  } catch (err) {
    console.error('/api/internal/cron/reminders failed', String(err));
    return json(500, { ok: false });
  }
};

export const GET = handler;
export const POST = handler;
