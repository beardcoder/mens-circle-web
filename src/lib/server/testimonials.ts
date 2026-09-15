/**
 * Testimonial submission, public fetch, and admin moderation (server-only).
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Testimonial as TestimonialDTO, TestimonialPayload } from '../types';
import { db } from './db';
import type { Testimonial } from './db/schema';
import { testimonials } from './db/schema';
import {
  accepted,
  consented,
  type FormResult,
  INVALID_EMAIL,
  isHoneypotFilled,
  MISSING_CONSENT,
  rejected,
} from './form-submission';

const SUCCESS_MESSAGE = 'Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.';
const QUOTE_MIN = 10;
const QUOTE_MAX = 1000;

/** Public testimonial submission — always stored unpublished for moderation. */
export async function submitTestimonial(payload: TestimonialPayload): Promise<FormResult> {
  const quote = (payload.quote || '').trim();
  const email = (payload.email || '').trim().toLowerCase();

  if (isHoneypotFilled(payload.website)) return accepted(SUCCESS_MESSAGE);

  if (!consented(payload.privacy)) return rejected(422, MISSING_CONSENT);
  if (quote.length < QUOTE_MIN || quote.length > QUOTE_MAX) {
    return rejected(422, `Dein Testimonial muss zwischen ${QUOTE_MIN} und ${QUOTE_MAX} Zeichen lang sein.`);
  }
  // The address is optional here — only a given one has to be usable.
  if (email && !email.includes('@')) return rejected(422, INVALID_EMAIL);

  await db.insert(testimonials).values({
    quote,
    authorName: (payload.author_name || '').trim(),
    role: (payload.role || '').trim(),
    email,
    isPublished: false,
    sortOrder: 0,
  });

  return accepted(SUCCESS_MESSAGE);
}

/**
 * Published testimonials for the public site, sorted by sortOrder then newest.
 *
 * `limit` exists for callers that only want the top of the curated order — the
 * /event landing page shows a single voice and has no use for the other 199.
 */
export async function fetchTestimonials(limit = 200): Promise<TestimonialDTO[]> {
  try {
    const rows = await db
      .select({ quote: testimonials.quote, authorName: testimonials.authorName, role: testimonials.role })
      .from(testimonials)
      .where(and(eq(testimonials.isPublished, true), isNull(testimonials.deleted)))
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      quote: r.quote,
      author: r.authorName || null,
      role: r.role || null,
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[testimonials] fetchTestimonials failed', String(err));
    return [];
  }
}

/** All non-deleted testimonials (admin), newest first. */
export async function listTestimonialsForAdmin(): Promise<Testimonial[]> {
  return db.select().from(testimonials).where(isNull(testimonials.deleted)).orderBy(desc(testimonials.createdAt));
}

/** Publish / unpublish a testimonial (sets published_at on first publish). */
export async function setTestimonialPublished(id: string, publish: boolean): Promise<Testimonial | null> {
  const existing = (await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1))[0];
  if (!existing) return null;
  const publishedAt = publish ? (existing.publishedAt ?? new Date().toISOString()) : existing.publishedAt;
  const rows = await db
    .update(testimonials)
    .set({ isPublished: publish, publishedAt })
    .where(eq(testimonials.id, id))
    .returning();
  return rows[0] ?? null;
}

/** Update the manual sort order. */
export async function setTestimonialSortOrder(id: string, sortOrder: number): Promise<void> {
  await db.update(testimonials).set({ sortOrder }).where(eq(testimonials.id, id));
}

/** Edit a testimonial's content (quote/author/role/email). */
export async function updateTestimonialContent(
  id: string,
  fields: { quote: string; authorName: string; role: string; email: string },
): Promise<Testimonial | null> {
  const rows = await db
    .update(testimonials)
    .set({
      quote: fields.quote.trim(),
      authorName: fields.authorName.trim(),
      role: fields.role.trim(),
      email: fields.email.trim(),
    })
    .where(and(eq(testimonials.id, id), isNull(testimonials.deleted)))
    .returning();
  return rows[0] ?? null;
}

/** Soft-delete a testimonial. */
export async function softDeleteTestimonial(id: string): Promise<void> {
  await db
    .update(testimonials)
    .set({ deleted: new Date().toISOString(), isPublished: false })
    .where(and(eq(testimonials.id, id), isNull(testimonials.deleted)));
}
