/**
 * Testimonial submission, public fetch, and admin moderation (server-only).
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { ApiResponse, Testimonial as TestimonialDTO, TestimonialPayload } from '../types';
import { db } from './db';
import type { Testimonial } from './db/schema';
import { testimonials } from './db/schema';

export interface SubmitResult {
  status: number;
  body: ApiResponse;
}

const SUCCESS_MESSAGE = 'Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.';

/** Public testimonial submission — always stored unpublished for moderation. */
export async function submitTestimonial(payload: TestimonialPayload): Promise<SubmitResult> {
  const quote = (payload.quote || '').trim();
  const authorName = (payload.author_name || '').trim();
  const role = (payload.role || '').trim();
  const email = (payload.email || '').trim().toLowerCase();

  // Honeypot — fake success, store nothing.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return { status: 200, body: { success: true, message: SUCCESS_MESSAGE } };
  }

  if (!(payload.privacy === true || (payload.privacy as unknown) === 'true')) {
    return { status: 422, body: { success: false, message: 'Bitte bestätige die Datenschutzerklärung.' } };
  }
  if (quote.length < 10 || quote.length > 1000) {
    return {
      status: 422,
      body: { success: false, message: 'Dein Testimonial muss zwischen 10 und 1000 Zeichen lang sein.' },
    };
  }
  if (email && !email.includes('@')) {
    return { status: 422, body: { success: false, message: 'Bitte gib eine gültige E-Mail-Adresse an.' } };
  }

  await db.insert(testimonials).values({
    quote,
    authorName,
    role,
    email,
    isPublished: false,
    sortOrder: 0,
  });

  return { status: 200, body: { success: true, message: SUCCESS_MESSAGE } };
}

/** Published testimonials for the public site, sorted by sortOrder then newest. */
export async function fetchTestimonials(): Promise<TestimonialDTO[]> {
  try {
    const rows = await db
      .select()
      .from(testimonials)
      .where(and(eq(testimonials.isPublished, true), isNull(testimonials.deleted)))
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt))
      .limit(200);
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
