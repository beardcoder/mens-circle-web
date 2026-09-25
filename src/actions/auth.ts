import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { readSession, SESSION_COOKIE } from '@lib/server/auth';

/** Admin actions live outside the `/admin` path the middleware guards, so every mutating one calls this first. */
export const requireAdmin = async (context: ActionAPIContext): Promise<string> => {
  const email = await readSession(context.cookies.get(SESSION_COOKIE)?.value);
  if (!email) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Nicht angemeldet.' });
  return email;
};

// Sign-in itself runs through Pocket ID (src/pages/auth/*), not an action.
export const auth = {
  logout: defineAction({
    handler: async (_input, context) => {
      context.cookies.delete(SESSION_COOKIE, { path: '/' });
      return { message: 'Abgemeldet.' };
    },
  }),
};
