import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';

import { readAdminOverview, readAdminRegistrations, readAdminTestimonials } from '@lib/server/admin-data';

import { requireAdmin } from './auth';

export const admin = {
  loadAdminOverview: defineAction({
    handler: async (_input, context) => {
      await requireAdmin(context);

      return readAdminOverview();
    },
  }),
  loadAdminRegistrations: defineAction({
    input: z.object({ eventId: z.string().min(1) }),
    handler: async ({ eventId }, context) => {
      await requireAdmin(context);
      const data = await readAdminRegistrations(eventId);

      if (!data) throw new ActionError({ code: 'NOT_FOUND', message: 'Veranstaltung nicht gefunden.' });

      return data;
    },
  }),
  loadAdminTestimonials: defineAction({
    handler: async (_input, context) => {
      await requireAdmin(context);

      return readAdminTestimonials();
    },
  }),
};
