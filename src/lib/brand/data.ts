/**
 * What a brand template prints: the coming dates and where to register. Built by
 * the render script from a JSON file (`brand/data.example.json`) or from the live
 * site's public API; validated here, so a template never meets a half-filled date.
 */
import { z } from 'astro/zod';

const brandEvent = z.object({
  /** "Freitag, 20. November 2026". */
  date: z.string().min(1),
  /** Calendar day, "2026-11-20". */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** "19:30–21:30 Uhr". */
  time: z.string(),
  /** "Geiselhöring". */
  place: z.string(),
  /** The event page; the QR code opens it. */
  url: z.string().url(),
  seats: z.object({ total: z.number().int().min(0), free: z.number().int().min(0) }).nullable(),
});

export const brandData = z.object({
  events: z.array(brandEvent),
  /** Where the dates are listed when no single one is printed. */
  datesUrl: z.string().url(),
});

export type BrandEvent = z.infer<typeof brandEvent>;
export type BrandData = z.infer<typeof brandData>;
