import { apiRoute } from '@lib/server/api';
import { register } from '@lib/server/registrations';
import type { RegistrationPayload } from '@lib/types';

export const prerender = false;

export const POST = apiRoute('event/register', 'event-register', 5, 3600, async (request) => {
  const payload = (await request.json()) as RegistrationPayload;
  const { status, body } = await register(payload);
  return Response.json(body, { status });
});
