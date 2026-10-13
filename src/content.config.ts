import { defineCollection, type ImageFunction } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * The page copy as content collections: one JSON file per entry, its file name the id.
 * Strict objects, so a misspelt or retired field fails the build instead of vanishing.
 * Each block's `data` matches the props of its component in `components/blocks/`.
 */

const text = z.string().optional();
const texts = z.array(z.string()).optional();
const steps = z.array(z.strictObject({ title: text, description: text })).optional();

const head = { anchor: text, eyebrow: text };

const block = <T extends string, S extends z.ZodRawShape>(type: T, data: S) =>
  z.strictObject({ type: z.literal(type), data: z.strictObject(data) });

const blocks = (image: ImageFunction) =>
  z.array(
    z.discriminatedUnion('type', [
      block('hero', {
        kicker: text,
        title: text,
        titleEmphasis: text,
        lede: text,
        secondaryLabel: text,
        secondaryLink: text,
      }),
      block('facts', head),
      block('intro', { ...head, title: text, text, questionsLabel: text, questions: texts, close: text }),
      block('journey-steps', { ...head, title: text, subtitle: text, steps, close: text }),
      block('statement', { ...head, lines: texts, text, linkLabel: text, linkUrl: text, breathGuide: text }),
      block('moderator', {
        ...head,
        name: text,
        quote: text,
        bio: text,
        image: image().optional(),
        imageAlt: text,
        linkLabel: text,
        linkUrl: text,
      }),
      block('frame', {
        ...head,
        title: text,
        intro: text,
        agreements: z.array(z.strictObject({ title: text, text })).optional(),
        boundaryTitle: text,
        boundaryText: text,
      }),
      block('testimonials', { ...head, title: text }),
      block('faq', {
        ...head,
        title: text,
        intro: text,
        items: z.array(z.strictObject({ question: text, answer: text })).optional(),
      }),
      block('dates', { ...head, displayLines: texts, lede: text, newsletterText: text, whatsappText: text }),
      block('cta', {
        ...head,
        title: text,
        text,
        buttonText: text,
        buttonLink: text,
        secondaryLabel: text,
        secondaryLink: text,
      }),
      block('value-items', { ...head, title: text, intro: text, items: steps }),
      block('page-hero', {
        ...head,
        title: text,
        lead: text,
        align: z.enum(['left', 'center']).optional(),
        buttonText: text,
        buttonLink: text,
        image: image().optional(),
        imageAlt: text,
        imageCaption: text,
      }),
      block('text-section', { ...head, title: text, content: text }),
    ]),
  );

/** Pages built from blocks: `home`, `warum-ich-den-maennerkreis-leite`. */
const pages = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content' }),
  schema: ({ image }) =>
    z.strictObject({
      meta: z.strictObject({
        title: z.string(),
        description: z.string(),
        ogTitle: text,
        ogDescription: text,
        datePublished: z.iso.date().optional(),
        dateModified: z.iso.date().optional(),
      }),
      blocks: blocks(image),
    }),
});

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

export const collections = { pages, legal };
