import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';

import { eventInputSchema } from '@lib/event-input';
import { createEvent, sendEventNewsletter, setEventPublished, softDeleteEvent, updateEvent } from '@lib/server/events';
import { invalidatePublicData } from '@lib/server/public-data';

import { requireAdmin } from './auth';

export const events = {
  saveEvent: defineAction({
    accept: 'form',
    input: eventInputSchema.extend({ id: z.string().optional() }),
    handler: async ({ id, ...input }, context) => {
      await requireAdmin(context);

      if (id) {
        const event = await updateEvent(id, input);

        if (!event) throw new ActionError({ code: 'NOT_FOUND', message: 'Veranstaltung nicht gefunden.' });

        await invalidatePublicData(context.cache);

        return { id: event.id, slug: event.slug, message: 'Veranstaltung gespeichert.' };
      }

      const event = await createEvent(input);

      await invalidatePublicData(context.cache);

      return { id: event.id, slug: event.slug, message: 'Veranstaltung erstellt.' };
    },
  }),

  setEventPublished: defineAction({
    input: z.object({ id: z.string().min(1), published: z.boolean() }),
    handler: async ({ id, published }, context) => {
      await requireAdmin(context);
      const updated = await setEventPublished(id, published);

      if (!updated) throw new ActionError({ code: 'NOT_FOUND', message: 'Veranstaltung nicht gefunden.' });

      await invalidatePublicData(context.cache);

      return { message: published ? 'Veranstaltung veröffentlicht.' : 'Veranstaltung als Entwurf gespeichert.' };
    },
  }),

  deleteEvent: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      await requireAdmin(context);
      await softDeleteEvent(id);
      await invalidatePublicData(context.cache);

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
