import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import type { ActionAPIContext } from 'astro:actions';
import { createSession, readSession, SESSION_COOKIE, SESSION_TTL_S, verifyCredentials } from '@lib/server/auth';
import { clientIp, rateLimit } from '@lib/server/ratelimit';
import { createEvent, type EventInput, sendEventNewsletter, softDeleteEvent, updateEvent } from '@lib/server/events';
import { broadcastEventMessage, changeRegistrationStatus, softDeleteRegistration } from '@lib/server/registrations';
import {
  setTestimonialPublished,
  setTestimonialSortOrder,
  softDeleteTestimonial,
  updateTestimonialContent,
} from '@lib/server/testimonials';

const requireAdmin = async (context: ActionAPIContext): Promise<string> => {
  const email = await readSession(context.cookies.get(SESSION_COOKIE)?.value);
  if (!email) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Nicht angemeldet.' });
  return email;
};

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

const numOrNull = (v: number | string | null | undefined): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Optional text field from the admin form; an omitted one is the empty string. */
const text = (v: string | undefined): string => (v ?? '').trim();

/** A date-only value from `<input type="date">` becomes midnight UTC; anything else is passed through. */
const toEventDate = (v: string | undefined): string => {
  const value = text(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
};

type EventRaw = z.output<typeof eventSchema>;

const toEventInput = (raw: EventRaw): EventInput => ({
  title: text(raw.title),
  slug: text(raw.slug) || undefined,
  description: raw.description ?? '',
  eventDate: toEventDate(raw.eventDate),
  startTime: text(raw.startTime),
  endTime: text(raw.endTime),
  location: text(raw.location),
  locationDetails: raw.locationDetails ?? '',
  street: text(raw.street),
  postalCode: text(raw.postalCode),
  city: text(raw.city),
  latitude: numOrNull(raw.latitude),
  longitude: numOrNull(raw.longitude),
  maxParticipants: Number(raw.maxParticipants) || 8,
  costBasis: text(raw.costBasis),
  isPublished: raw.isPublished === true,
  imageUrl: text(raw.imageUrl) || null,
});

export const server = {
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

  sendEventNewsletter: defineAction({
    input: z.object({ id: z.string(), subject: z.string(), intro: z.string().optional() }),
    handler: async ({ id, subject, intro }, context) => {
      await requireAdmin(context);
      if (!subject.trim()) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Betreff ist erforderlich.' });
      }
      const res = await sendEventNewsletter(id, subject, intro ?? '');
      if (!res.ok) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: res.error ?? 'Versand fehlgeschlagen.' });
      }
      return { message: `Newsletter wird an die Liste gesendet (Kampagne #${res.campaignId}).` };
    },
  }),

  setRegistrationStatus: defineAction({
    input: z.object({
      id: z.string(),
      status: z.enum(['registered', 'waitlist', 'cancelled', 'attended']),
    }),
    handler: async ({ id, status }, context) => {
      await requireAdmin(context);
      const updated = await changeRegistrationStatus(id, status);
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
