import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { accepted, type FormResult, isHoneypotFilled, rejected } from '@lib/server/form-submission';
import { subscribeToNewsletter } from '@lib/server/listmonk';
import { clientIp, rateLimit } from '@lib/server/ratelimit';
import { register } from '@lib/server/registrations';
import { submitTestimonial } from '@lib/server/testimonials';

/**
 * The public forms: rate-limited per IP, answered in the visitor's language, and
 * never leaking an internal error. Field rules live in the schemas below; what
 * only the data can decide — capacity, waitlist, duplicates — lives in lib/server
 * and answers with a `FormResult`.
 */
const publicForm =
  <T>(key: string, maxPerHour: number, handler: (input: T) => Promise<FormResult>) =>
  async (input: T, context: ActionAPIContext): Promise<{ message: string }> => {
    if (!rateLimit(key, clientIp(context.request), maxPerHour, 3600)) {
      throw new ActionError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Zu viele Anfragen. Bitte versuche es später erneut.',
      });
    }
    let result: FormResult;
    try {
      result = await handler(input);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[actions] ${key} failed`, String(err));
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
      });
    }
    if (!result.body.success) {
      throw new ActionError({ code: ActionError.statusToCode(result.status), message: result.body.message });
    }
    return { message: result.body.message };
  };

/*
 * Field rules for the public forms, worded for the visitor. A failed rule comes
 * back as an input error, which the form script writes beside the field
 * (`isInputError(error).fields`). An empty form field arrives as null.
 */
const required = (message: string) => z.string({ error: message }).trim().min(1, { error: message });
const email = z
  .string({ error: 'Bitte gib deine E-Mail-Adresse an.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Diese E-Mail-Adresse sieht nicht gültig aus.' }));
const optional = z.string().trim().nullish();
const privacy = z.boolean().refine(Boolean, { error: 'Bitte bestätige die Datenschutzerklärung.' });
/** Honeypot — real users never see it, so they leave it empty. */
const website = z.string().nullish();

const NEWSLETTER_SUCCESS =
  'Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.';

const subscribe = async (input: { email: string; website?: string | null }): Promise<FormResult> => {
  if (isHoneypotFilled(input.website)) return accepted(NEWSLETTER_SUCCESS);
  const result = await subscribeToNewsletter(input.email, '');
  if (result.status === 'exists')
    return rejected(409, 'Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet.');
  if (!result.ok) return rejected(502, 'Die Anmeldung ist momentan nicht möglich. Bitte versuche es später erneut.');
  return accepted(NEWSLETTER_SUCCESS);
};

export const forms = {
  register: defineAction({
    accept: 'form',
    input: z.object({
      event_id: required('Es wurde keine Veranstaltung angegeben.'),
      first_name: required('Bitte gib deinen Vornamen an.'),
      last_name: required('Bitte gib deinen Nachnamen an.'),
      email,
      phone_number: optional,
      privacy,
      website,
    }),
    handler: publicForm('event-register', 5, register),
  }),

  subscribeNewsletter: defineAction({
    accept: 'form',
    input: z.object({ email, website }),
    handler: publicForm('newsletter', 5, subscribe),
  }),

  submitTestimonial: defineAction({
    accept: 'form',
    input: z.object({
      quote: required('Bitte teile deine Erfahrung mit uns.')
        .min(10, { error: 'Noch etwas mehr, bitte — mindestens 10 Zeichen.' })
        .max(1000, { error: 'Bitte kürze deinen Text auf maximal 1000 Zeichen.' }),
      author_name: optional,
      role: optional,
      email,
      privacy,
      website,
    }),
    handler: publicForm('testimonial', 3, submitTestimonial),
  }),
};
