import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import {
  setTestimonialPublished,
  setTestimonialSortOrder,
  softDeleteTestimonial,
  updateTestimonialContent,
} from '@lib/server/testimonials';
import { requireAdmin } from './auth';

export const testimonials = {
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
