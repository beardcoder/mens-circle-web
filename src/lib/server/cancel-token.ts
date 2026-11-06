/**
 * The signed link in every participant mail that lets them cancel their own
 * registration: HMAC like the admin session (auth.ts), bound to one registration and
 * a purpose, valid until the end of the event's day. A session token never passes
 * as a cancel token and the other way round (different fields).
 */
import { addDays, eventDay } from '../shared/time';
import { signToken, verifyToken } from './auth';
import { config } from './config';

const PURPOSE = 'cancel';
/** Grace after the event day ends (Berlin is at most two hours ahead of UTC). */
const GRACE_MS = 2 * 3_600_000;

/** The link's expiry: the end of the event's calendar day. */
const expiresAt = (eventDate: string): number => {
  const day = eventDay(eventDate);

  return day ? Date.parse(`${addDays(day, 1)}T00:00:00Z`) + GRACE_MS : 0;
};

export const createCancelToken = async (registrationId: string, eventDate: string): Promise<string | null> => {
  const ttlS = Math.floor((expiresAt(eventDate) - Date.now()) / 1000);

  if (ttlS <= 0) return null;

  try {
    return await signToken({ p: PURPOSE, r: registrationId }, ttlS);
  } catch {
    // No session secret configured: the mails fall back to "write to us".
    return null;
  }
};

/** The registration id a valid, unexpired cancel token names, else null. */
export const readCancelToken = async (token: string | null | undefined): Promise<string | null> => {
  const data = await verifyToken<{ p?: unknown; r?: unknown }>(token ?? undefined);

  return data?.p === PURPOSE && typeof data.r === 'string' ? data.r : null;
};

/** The absolute URL of the cancel page for one registration, or '' when no link can be signed. */
export const cancelUrlFor = async (registrationId: string, eventDate: string): Promise<string> => {
  const token = await createCancelToken(registrationId, eventDate);

  return token ? `${config.APP_URL}/anmeldung/absagen?token=${encodeURIComponent(token)}` : '';
};
