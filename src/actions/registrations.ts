import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';

import { REGISTRATION_STATUSES } from '@lib/server/db/schema';
import { purgePublicCache } from '@lib/server/public-data';
import {
  broadcastEventMessage,
  changeRegistrationStatus,
  resendRegistrationConfirmations,
  setRegistrationNote,
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
      status: z.enum(REGISTRATION_STATUSES),
      /** The admin confirmed taking a seat beyond the capacity. */
      overbook: z.boolean().optional(),
    }),
    handler: async ({ id, status, overbook }, context) => {
      await requireAdmin(context);
      const change = await changeRegistrationStatus(id, status, { overbook });

      if (!change.ok && change.reason === 'full') {
        throw new ActionError({
          code: 'CONFLICT',
          message: 'Der Termin ist voll. Bestätige die Überbuchung, wenn du trotzdem einen Platz vergeben willst.',
        });
      }

      if (!change.ok) throw new ActionError({ code: 'NOT_FOUND', message: 'Anmeldung nicht gefunden.' });

      await purgePublicCache(context);

      return { message: 'Status aktualisiert.' };
    },
  }),

  saveRegistrationNote: defineAction({
    input: z.object({ id: z.string(), note: z.string().max(2000, 'Höchstens 2000 Zeichen.') }),
    handler: async ({ id, note }, context) => {
      await requireAdmin(context);

      if (!(await setRegistrationNote(id, note))) {
        throw new ActionError({ code: 'NOT_FOUND', message: 'Anmeldung nicht gefunden.' });
      }

      return { message: 'Notiz gespeichert.' };
    },
  }),

  deleteRegistration: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }, context) => {
      await requireAdmin(context);

      if (!(await softDeleteRegistration(id))) {
        throw new ActionError({ code: 'NOT_FOUND', message: 'Anmeldung nicht gefunden.' });
      }

      await purgePublicCache(context);

      return { message: 'Anmeldung entfernt.' };
    },
  }),
};
