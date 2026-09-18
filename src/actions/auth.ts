import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { createSession, readSession, SESSION_COOKIE, SESSION_TTL_S, verifyCredentials } from '@lib/server/auth';
import { clientIp, rateLimit } from '@lib/server/ratelimit';

/**
 * Admin actions live outside the `/admin` path the middleware guards, so every
 * mutating one calls this first.
 */
export const requireAdmin = async (context: ActionAPIContext): Promise<string> => {
  const email = await readSession(context.cookies.get(SESSION_COOKIE)?.value);
  if (!email) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Nicht angemeldet.' });
  return email;
};

export const auth = {
  login: defineAction({
    input: z.object({ email: z.string(), password: z.string() }),
    handler: async ({ email, password }, context) => {
      if (!rateLimit('admin-login', clientIp(context.request), 10, 600)) {
        throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: 'Zu viele Versuche. Bitte später erneut.' });
      }
      if (!verifyCredentials(email, password)) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'E-Mail oder Passwort ist falsch.' });
      }
      const token = await createSession(email.trim().toLowerCase());
      context.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_TTL_S,
      });
      return { message: 'Angemeldet.' };
    },
  }),

  logout: defineAction({
    handler: async (_input, context) => {
      context.cookies.delete(SESSION_COOKIE, { path: '/' });
      return { message: 'Abgemeldet.' };
    },
  }),
};
