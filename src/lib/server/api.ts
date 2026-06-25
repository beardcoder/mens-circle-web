/* eslint-disable no-console */
import type { APIRoute } from 'astro';
import { clientIp, rateLimit } from './ratelimit';

export const tooManyRequests = (): Response =>
  Response.json({ success: false, message: 'Zu viele Anfragen. Bitte versuche es später erneut.' }, { status: 429 });

export const internalError = (): Response =>
  Response.json(
    { success: false, message: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.' },
    { status: 500 },
  );

export const apiRoute =
  (
    label: string,
    rateLimitKey: string,
    maxReq: number,
    windowSec: number,
    handler: (request: Request) => Promise<Response>,
  ): APIRoute =>
  async ({ request }) => {
    if (!rateLimit(rateLimitKey, clientIp(request), maxReq, windowSec)) return tooManyRequests();
    try {
      return await handler(request);
    } catch (err) {
      console.error(`[api] ${label} failed`, String(err));
      return internalError();
    }
  };
