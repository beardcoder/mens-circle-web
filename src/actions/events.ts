import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';

import { eventInputSchema } from '@lib/event-input';
import { createEvent, sendEventNewsletter, softDeleteEvent, updateEvent } from '@lib/server/events';
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

        invalidatePublicData();

        return { id: event.id, message: 'Veranstaltung gespeichert.' };
      }

      const event = await createEvent(input);

      invalidatePublicData();

      return { id: event.id, message: 'Veranstaltung erstellt.' };
    },
  }),

  deleteEvent: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      await requireAdmin(context);
      await softDeleteEvent(id);
      invalidatePublicData();

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
