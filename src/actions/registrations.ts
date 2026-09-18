import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import {
  broadcastEventMessage,
  changeRegistrationStatus,
  resendRegistrationConfirmations,
  softDeleteRegistration,
} from '@lib/server/registrations';
import { requireAdmin } from './auth';

export const registrations = {
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

  resendConfirmations: defineAction({
    input: z.object({
      eventId: z.string(),
      ids: z.array(z.string()).optional(),
      onlyMissing: z.boolean().optional(),
    }),
    handler: async ({ eventId, ids, onlyMissing }, context) => {
      await requireAdmin(context);
      const { sent, failed, skipped } = await resendRegistrationConfirmations(eventId, { ids, onlyMissing });
      if (sent === 0 && failed === 0) {
        return { sent, failed, message: 'Keine passende Anmeldung gefunden — nichts gesendet.' };
      }
      const parts = [`${sent} Bestätigung${sent === 1 ? '' : 'en'} gesendet`];
      if (failed > 0) parts.push(`${failed} fehlgeschlagen`);
      if (skipped > 0) parts.push(`${skipped} übersprungen`);
      return { sent, failed, message: `${parts.join(', ')}.` };
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
};
