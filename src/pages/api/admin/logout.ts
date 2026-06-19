import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '@lib/server/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return Response.json({ success: true, message: 'Abgemeldet.' });
};
