/**
 * The site's one EmDash plugin (native: it runs in the server process). It owns what
 * the collections cannot do alone: public sign-ups that write entries, the seat
 * limit, the participant mails, the cancel link, the reminders and the deletion of
 * old registrations. The admin edits everything else in EmDash itself.
 *
 * The public forms reach these routes through their Astro Actions
 * (`lib/server/plugin-route.ts`), which add the rate limit, the honeypot and the
 * German messages.
 */
import { z } from 'astro/zod';
import type { PluginDescriptor } from 'emdash';
import { definePlugin, PluginRouteError } from 'emdash';

import { readCancelToken } from '../lib/server/cancel-token';
import { register } from '../lib/server/registration';
import { runReminders, runRetention, type Store } from '../lib/server/registration-tasks';

const ID = 'mens-circle';
const VERSION = '1.0.0';

export const mensCircle = (): PluginDescriptor => ({
  id: ID,
  version: VERSION,
  format: 'native',
  entrypoint: new URL('./index.ts', import.meta.url).pathname,
  options: {},
});

/** The plugin context as the tasks use it; `content` and `email` exist by the capabilities below. */
const store = (ctx: unknown): Store => ctx as Store;

const text = (max: number) => z.string().trim().max(max);

const registrationInput = z.object({
  event_id: text(64).min(1),
  first_name: text(100).min(1),
  last_name: text(100).min(1),
  email: z.email().max(200),
  phone: text(50).optional(),
});

const testimonialInput = z.object({
  quote: text(1000).min(10),
  name: text(100).optional(),
  role: text(100).optional(),
});

const cancelInput = z.object({ token: z.string().max(1000) });

export function createPlugin() {
  return definePlugin({
    id: ID,
    version: VERSION,
    capabilities: ['content:write', 'content:publish', 'email:send'],

    hooks: {
      'plugin:activate': {
        handler: async (_event, ctx) => {
          // Every quarter hour for the reminders; the deletion daily at 02:30 UTC.
          await ctx.cron?.schedule('reminders', { schedule: '*/15 * * * *' });
          await ctx.cron?.schedule('retention', { schedule: '30 2 * * *' });
        },
      },
      cron: {
        handler: async (event, ctx) => {
          if (event.name === 'reminders') await runReminders(store(ctx));

          if (event.name === 'retention') await runRetention(store(ctx));
        },
      },
    },

    routes: {
      register: {
        public: true,
        input: registrationInput,
        handler: async (ctx) => register(store(ctx), ctx.input as z.infer<typeof registrationInput>),
      },

      testimonial: {
        public: true,
        input: testimonialInput,
        // A draft: the voice appears once it is published in the admin.
        handler: async (ctx) => {
          const input = ctx.input as z.infer<typeof testimonialInput>;

          await store(ctx).content.create('testimonials', {
            quote: input.quote,
            name: input.name ?? '',
            role: input.role ?? '',
          });

          return { ok: true };
        },
      },

      cancel: {
        public: true,
        input: cancelInput,
        handler: async (ctx) => {
          const id = await readCancelToken((ctx.input as z.infer<typeof cancelInput>).token);
          const item = id ? await store(ctx).content.get('registrations', id) : null;

          if (!item) throw new PluginRouteError('NOT_FOUND', 'Diese Anmeldung gibt es nicht mehr.', 404);

          if (item.data.cancelled_at) return { result: 'already' };

          await store(ctx).content.update('registrations', item.id, { cancelled_at: new Date().toISOString() });

          return { result: 'cancelled' };
        },
      },
    },
  });
}
