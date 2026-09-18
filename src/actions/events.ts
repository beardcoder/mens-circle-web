import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { createEvent, type EventInput, sendEventNewsletter, softDeleteEvent, updateEvent } from '@lib/server/events';
import { requireAdmin } from './auth';

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

/** Optional admin-form text; an omitted field becomes the empty string. */
const text = (v: string | undefined): string => (v ?? '').trim();

/** A date-only `<input type="date">` value becomes midnight UTC. */
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

export const events = {
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
};
