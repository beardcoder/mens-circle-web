import { z } from 'astro/zod';

// Astro represents empty form controls as null.
const text = z
  .string()
  .nullish()
  .transform((value) => value?.trim() ?? '');

const prose = z
  .string()
  .nullish()
  .transform((value) => value ?? '');

const coordinate = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    if (value === '' || value == null) return null;

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  });

/** The event form's one validation and normalization boundary. */
export const eventInputSchema = z.object({
  title: z.string({ error: 'Titel ist erforderlich.' }).trim().min(1, 'Titel ist erforderlich.'),
  slug: text.transform((value) => value || undefined),
  description: prose,
  eventDate: z
    .string({ error: 'Datum ist erforderlich.' })
    .trim()
    .min(1, 'Datum ist erforderlich.')
    .transform((value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value)),
  startTime: text,
  endTime: text,
  location: text,
  locationDetails: prose,
  street: text,
  postalCode: text,
  city: text,
  latitude: coordinate,
  longitude: coordinate,
  maxParticipants: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value) => Number(value) || 8),
  costBasis: text,
  isPublished: z.boolean().default(false),
  imageUrl: text.transform((value) => value || null),
});

export type EventInput = z.output<typeof eventInputSchema>;
