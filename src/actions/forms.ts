import { type ActionAPIContext, ActionError, defineAction } from 'astro:actions'
import { z } from 'astro/zod'

import { config } from '@lib/server/config'
import { accepted, type FormResult, rejected } from '@lib/server/form-submission'
import { subscribeToNewsletter } from '@lib/server/listmonk'
import { callPlugin, PluginRefusal } from '@lib/server/plugin-route'
import { purgePublicCache } from '@lib/server/public-data'
import { clientIp, peerAddress, rateLimit } from '@lib/server/ratelimit'
import { confirmationMessage } from '@lib/server/registration'

/**
 * The public forms: rate-limited per IP, answered in the visitor's language, and never
 * leaking an internal error. A filled honeypot (`website`) gets `fakeSuccess` unhandled;
 * `onSuccess` runs after an accepted submission (a registration changes the seat counts).
 */
const publicForm
  = <T>(
    key: string,
    maxPerHour: number,
    handler: (input: T, context: ActionAPIContext) => Promise<FormResult>,
    fakeSuccess: (input: T) => string,
    onSuccess?: (context: ActionAPIContext) => Promise<void>,
  ) =>
    async (input: T & { website?: string | null }, context: ActionAPIContext): Promise<{ message: string }> => {
      if (input.website?.trim()) return { message: fakeSuccess(input) }

      if (!rateLimit(key, clientIp(context.request, peerAddress(context), config.TRUSTED_PROXY), maxPerHour, 3600)) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Anfragen. Bitte versuche es später erneut.',
        })
      }

      let result: FormResult

      try {
        result = await handler(input, context)
      }
      catch (err) {
        if (err instanceof PluginRefusal)
          throw new ActionError({ code: ActionError.statusToCode(err.status), message: err.message })

        // eslint-disable-next-line no-console
        console.error(`[actions] ${key} failed`, String(err))
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
        })
      }

      if (!result.body.success) {
        throw new ActionError({ code: ActionError.statusToCode(result.status), message: result.body.message })
      }

      await onSuccess?.(context)

      return { message: result.body.message }
    }

/* Field rules for the public forms, worded for the visitor. */
const required = (message: string) => z.string({ error: message }).trim().min(1, { error: message })

const email = z
  .string({ error: 'Bitte gib deine E-Mail-Adresse an.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Diese E-Mail-Adresse sieht nicht gültig aus.' }))

const optional = z.string().trim().nullish()
const privacy = z.boolean().refine(Boolean, { error: 'Bitte bestätige die Datenschutzerklärung.' })
/** Honeypot — real users never see it, so they leave it empty. */
const website = z.string().nullish()

const NEWSLETTER_SUCCESS
  = 'Danke! Schau in dein Postfach und bestätige die Adresse, dann bekommst du die Termine per E-Mail.'

const subscribe = async (input: { email: string }): Promise<FormResult> => {
  const result = await subscribeToNewsletter(input.email, '')

  if (result.status === 'exists') return rejected(409, 'Diese E-Mail-Adresse bekommt die Termine bereits per E-Mail.')

  if (!result.ok) return rejected(502, 'Die Anmeldung ist momentan nicht möglich. Bitte versuche es später erneut.')

  return accepted(NEWSLETTER_SUCCESS)
}

const TESTIMONIAL_SUCCESS
  = 'Vielen Dank! Deine Erfahrung ist angekommen und erscheint, sobald ich sie freigegeben habe.'

/** Through the plugin, which writes the entry (and for a sign-up sends the mails). */
const viaPlugin
  = <T>(route: string, payload: (input: T) => Record<string, unknown>, message?: (input: T) => string) =>
    async (input: T, context: ActionAPIContext): Promise<FormResult> => {
      const data = await callPlugin<{ message?: string }>(context.locals, route, payload(input))

      return accepted(data.message ?? message?.(input) ?? '')
    }

type Registration = {
  event_id: string
  first_name: string
  last_name: string
  email: string
  phone_number?: string | null
}
type Testimonial = { quote: string, author_name?: string | null, role?: string | null }

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
    handler: publicForm(
      'event-register',
      5,
      viaPlugin<Registration>('register', input => ({
        event_id: input.event_id,
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone_number ?? undefined,
      })),
      input => confirmationMessage(input.first_name),
      purgePublicCache,
    ),
  }),

  subscribeNewsletter: defineAction({
    accept: 'form',
    input: z.object({ email, website }),
    handler: publicForm('newsletter', 5, subscribe, () => NEWSLETTER_SUCCESS),
  }),

  submitTestimonial: defineAction({
    accept: 'form',
    input: z.object({
      quote: required('Bitte teile deine Erfahrung mit uns.')
        .min(10, { error: 'Noch etwas mehr, bitte — mindestens 10 Zeichen.' })
        .max(1000, { error: 'Bitte kürze deinen Text auf maximal 1000 Zeichen.' }),
      author_name: optional,
      role: optional,
      privacy,
      website,
    }),
    handler: publicForm(
      'testimonial',
      3,
      viaPlugin<Testimonial>(
        'testimonial',
        input => ({ quote: input.quote, name: input.author_name ?? undefined, role: input.role ?? undefined }),
        () => TESTIMONIAL_SUCCESS,
      ),
      () => TESTIMONIAL_SUCCESS,
    ),
  }),
}
