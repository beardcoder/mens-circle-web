import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** The legal pages, one HTML body each; the id is the URL (`/impressum`, `/datenschutz`). */
const legal = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/legal' }),
  schema: z.strictObject({
    title: z.string(),
    robots: z.string().default('noindex, nofollow'),
    meta: z.strictObject({ title: z.string(), description: z.string() }),
    content: z.string(),
  }),
});

export const collections = { legal };
