/**
 * Admin server actions — the entire admin back-office RPC surface in one typed
 * file. Replaces the former hand-written `/api/admin/*` JSON endpoints and the
 * `admin-client.ts` fetch wrapper: components call `actions.<name>(input)` and
 * get a typed `{ data, error }`; auth, validation, and JSON are handled here.
 *
 * Business logic still lives in `src/lib/server/*` — actions are a thin,
 * validated, authenticated edge over it. `src/middleware.ts` guards the admin
 * *pages*; each mutating action guards itself via `requireAdmin` (actions are
 * served from `/_actions/*`, outside the middleware's `/admin` path match).
 */
import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import type { ActionAPIContext } from 'astro:actions';
import { createSession, readSession, SESSION_COOKIE, verifyCredentials } from '@lib/server/auth';
import { clientIp, rateLimit } from '@lib/server/ratelimit';
import { createEvent, type EventInput, softDeleteEvent, updateEvent } from '@lib/server/events';
import {
  broadcastEventMessage,
  changeRegistrationStatus,
  type RegStatus,
  softDeleteRegistration,
} from '@lib/server/registrations';
import {
  setTestimonialPublished,
  setTestimonialSortOrder,
  softDeleteTestimonial,
  updateTestimonialContent,
} from '@lib/server/testimonials';

/** Throw UNAUTHORIZED unless the request carries a valid admin session. */
async function requireAdmin(context: ActionAPIContext): Promise<string> {
  const email = await readSession(context.cookies.get(SESSION_COOKIE)?.value);
  if (!email) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Nicht angemeldet.' });
  return email;
}

// ── Event form coercion ──────────────────────────────────────────────────────
// The form ships strings; numeric fields may be empty. Mirror the old
// parseEventBody so stored shapes are identical.
const eventSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  slug: z.string().optional(),
  description: z.string().optional(),
  eventDate: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  locationDetails: z.string().optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  latitude: z.union([z.number(), z.string()]).nullish(),
  longitude: z.union([z.number(), z.string()]).nullish(),
  maxParticipants: z.union([z.number(), z.string()]).optional(),
  costBasis: z.string().optional(),
  isPublished: z.boolean().optional(),
  imageUrl: z.string().optional(),
});

function numOrNull(v: number | string | null | undefined): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type EventRaw = (typeof eventSchema)['_output'];

function toEventInput(raw: EventRaw): EventInput {
  // "YYYY-MM-DD" from the date input → ISO UTC, matching the old endpoint.
  let eventDate = (raw.eventDate ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) eventDate = `${eventDate}T00:00:00.000Z`;
  return {
    title: (raw.title ?? '').trim(),
    slug: (raw.slug ?? '').trim() || undefined,
    description: raw.description ?? '',
    eventDate,
    startTime: (raw.startTime ?? '').trim(),
    endTime: (raw.endTime ?? '').trim(),
    location: (raw.location ?? '').trim(),
    locationDetails: raw.locationDetails ?? '',
    street: (raw.street ?? '').trim(),
    postalCode: (raw.postalCode ?? '').trim(),
    city: (raw.city ?? '').trim(),
    latitude: numOrNull(raw.latitude),
    longitude: numOrNull(raw.longitude),
    maxParticipants: Number(raw.maxParticipants) || 8,
    costBasis: (raw.costBasis ?? '').trim(),
    isPublished: raw.isPublished === true,
    imageUrl: (raw.imageUrl ?? '').trim() || null,
  };
}

export const server = {
  // ── Auth ──
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
        maxAge: 7 * 24 * 60 * 60,
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

  // ── Events ──
  saveEvent: defineAction({
    input: eventSchema,
    handler: async (raw, context) => {
      await requireAdmin(context);
      const input = toEventInput(raw);
      if (!input.title) throw new ActionError({ code: 'BAD_REQUEST', message: 'Titel ist erforderlich.' });
      if (!input.eventDate) throw new ActionError({ code: 'BAD_REQUEST', message: 'Datum ist erforderlich.' });
      if (raw.id) {
        const event = await updateEvent(raw.id, input);
        if (!event) throw new ActionError({ code: 'NOT_FOUND', message: 'Veranstaltung nicht gefunden.' });
        return { id: event.id, message: 'Veranstaltung gespeichert.' };
      }
      const event = await createEvent(input);
      return { id: event.id, message: 'Veranstaltung erstellt.' };
    },
  }),

  deleteEvent: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      await requireAdmin(context);
      await softDeleteEvent(id);
      return { message: 'Veranstaltung gelöscht.' };
    },
  }),

  sendEventMessage: defineAction({
    input: z.object({ id: z.string(), subject: z.string(), content: z.string() }),
    handler: async ({ id, subject, content }, context) => {
      await requireAdmin(context);
      if (!subject.trim() || !content.trim()) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Betreff und Nachricht sind erforderlich.' });
      }
      const { sent, total } = await broadcastEventMessage(id, subject.trim(), content);
      return { message: `Nachricht an ${sent} von ${total} Teilnehmer:innen gesendet.` };
    },
  }),

  // ── Registrations ──
  setRegistrationStatus: defineAction({
    input: z.object({
      id: z.string(),
      status: z.enum(['registered', 'waitlist', 'cancelled', 'attended']),
    }),
    handler: async ({ id, status }, context) => {
      await requireAdmin(context);
      const updated = await changeRegistrationStatus(id, status as RegStatus);
      if (!updated) throw new ActionError({ code: 'NOT_FOUND', message: 'Anmeldung nicht gefunden.' });
      return { message: 'Status aktualisiert.' };
    },
  }),

  deleteRegistration: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      await requireAdmin(context);
      await softDeleteRegistration(id);
      return { message: 'Anmeldung entfernt.' };
    },
  }),

  // ── Testimonials ──
  moderateTestimonial: defineAction({
    input: z.object({ id: z.string(), publish: z.boolean().optional(), sortOrder: z.number().optional() }),
    handler: async ({ id, publish, sortOrder }, context) => {
      await requireAdmin(context);
      if (typeof sortOrder === 'number') await setTestimonialSortOrder(id, sortOrder);
      if (typeof publish === 'boolean') {
        const updated = await setTestimonialPublished(id, publish);
        if (!updated) throw new ActionError({ code: 'NOT_FOUND', message: 'Nicht gefunden.' });
      }
      return { message: 'Gespeichert.' };
    },
  }),

  updateTestimonial: defineAction({
    input: z.object({
      id: z.string(),
      quote: z.string(),
      authorName: z.string(),
      role: z.string(),
      email: z.string(),
    }),
    handler: async ({ id, quote, authorName, role, email }, context) => {
      await requireAdmin(context);
      if (!quote.trim()) throw new ActionError({ code: 'BAD_REQUEST', message: 'Zitat darf nicht leer sein.' });
      const updated = await updateTestimonialContent(id, { quote, authorName, role, email });
      if (!updated) throw new ActionError({ code: 'NOT_FOUND', message: 'Nicht gefunden.' });
      return { message: 'Stimme gespeichert.' };
    },
  }),

  deleteTestimonial: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      await requireAdmin(context);
      await softDeleteTestimonial(id);
      return { message: 'Gelöscht.' };
    },
  }),
};
