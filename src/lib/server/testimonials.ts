import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Testimonial as TestimonialDTO } from '../types';
import { db } from './db';
import type { Testimonial } from './db/schema';
import { testimonials } from './db/schema';
import { accepted, type FormResult, isHoneypotFilled } from './form-submission';

const SUCCESS_MESSAGE = 'Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.';

/** The testimonial form, already validated by the `submitTestimonial` action's schema. */
export interface TestimonialInput {
  quote: string;
  email: string;
  author_name?: string | null;
  role?: string | null;
  /** Honeypot — real users leave it empty. */
  website?: string | null;
}

/** Always stored unpublished, for moderation. */
export async function submitTestimonial(payload: TestimonialInput): Promise<FormResult> {
  if (isHoneypotFilled(payload.website)) return accepted(SUCCESS_MESSAGE);

  await db.insert(testimonials).values({
    quote: payload.quote.trim(),
    authorName: (payload.author_name || '').trim(),
    role: (payload.role || '').trim(),
    email: payload.email.trim().toLowerCase(),
    isPublished: false,
    sortOrder: 0,
  });

  return accepted(SUCCESS_MESSAGE);
}

/** Published testimonials, sorted by sortOrder then newest. */
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

/** Publish or unpublish; stamps published_at on first publish. */
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

/** Edit quote, author, role or email. */
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
