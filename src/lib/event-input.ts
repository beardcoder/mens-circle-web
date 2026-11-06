import { z } from 'astro/zod';

import { parseClockTime } from './shared/time';

// Astro represents empty form controls as null.
const text = z
  .string()
  .nullish()
  .transform((value) => value?.trim() ?? '');

const prose = z
  .string()
  .nullish()
  .transform((value) => value ?? '');

/** A blank control, or a number in [min, max] (form controls arrive as strings). */
const coordinate = (min: number, max: number, message: string) =>
  z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value, ctx) => {
      const raw = typeof value === 'string' ? value.trim().replace(',', '.') : value;

      if (raw === '' || raw == null) return null;

      const number = Number(raw);

      if (!Number.isFinite(number) || number < min || number > max) {
        ctx.addIssue({ code: 'custom', message });

        return z.NEVER;
      }

      return number;
    });

/** "19:00" or blank. */
const clock = text.refine((value) => value === '' || parseClockTime(value) !== null, {
  message: 'Bitte als Uhrzeit angeben, zum Beispiel 19:00.',
});

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A real calendar day ("2026-11-12", also as the stored "…T00:00:00.000Z"). */
const isCalendarDay = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(value);

  if (!match) return false;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const eventFields = z.object({
  title: z.string({ error: 'Titel ist erforderlich.' }).trim().min(1, 'Titel ist erforderlich.'),
  slug: text
    .refine((value) => value === '' || (value.length <= 80 && SLUG.test(value)), {
      message: 'Nur Kleinbuchstaben, Ziffern und einzelne Bindestriche, höchstens 80 Zeichen.',
    })
    .transform((value) => value || undefined),
  description: prose,
  eventDate: z
    .string({ error: 'Datum ist erforderlich.' })
    .trim()
    .min(1, 'Datum ist erforderlich.')
    .refine(isCalendarDay, 'Bitte ein gültiges Datum angeben.')
    .transform((value) => `${value.slice(0, 10)}T00:00:00.000Z`),
  startTime: clock,
  endTime: clock,
  location: text,
  locationDetails: prose,
  street: text,
  postalCode: text,
  city: text,
  latitude: coordinate(-90, 90, 'Breitengrad zwischen -90 und 90, zum Beispiel 48.88.'),
  longitude: coordinate(-180, 180, 'Längengrad zwischen -180 und 180, zum Beispiel 12.57.'),
  maxParticipants: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value) => (value === '' || value == null ? 8 : Number(value)))
    .pipe(
      z
        .number({ error: 'Bitte eine ganze Zahl zwischen 1 und 200 angeben.' })
        .int('Bitte eine ganze Zahl zwischen 1 und 200 angeben.')
        .min(1, 'Mindestens ein Platz.')
        .max(200, 'Höchstens 200 Plätze.'),
    ),
  costBasis: text,
  isPublished: z.boolean().default(false),
  imageUrl: text
    .refine((value) => value === '' || (URL.canParse(value) && new URL(value).protocol === 'https:'), {
      message: 'Bitte eine vollständige https-Adresse angeben.',
    })
    .transform((value) => value || null),
});

/** Times that belong together: an end needs a start and comes after it. */
const checkTimes = (input: { startTime: string; endTime: string }, ctx: z.RefinementCtx): void => {
  const start = parseClockTime(input.startTime);
  const end = parseClockTime(input.endTime);

  if (start !== null && end !== null && end <= start) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Das Ende liegt nach dem Beginn.' });
  }

  if (end !== null && start === null) {
    ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Bitte auch den Beginn angeben.' });
  }
};

/** The event form's one validation and normalization boundary; messages appear at the fields. */
export const eventInputSchema = eventFields.superRefine(checkTimes);

/** The save action's input: the form plus the id of an event being edited. */
export const saveEventSchema = eventFields.extend({ id: z.string().optional() }).superRefine(checkTimes);

export type EventInput = z.output<typeof eventInputSchema>;
