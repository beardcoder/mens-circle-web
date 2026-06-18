/**
 * Testimonial service. Public submissions are always stored unpublished for
 * moderation (ported from `routes_testimonial.pb.js`); the public list returns
 * only published ones, sorted. Admin methods moderate.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Testimonial } from '../../lib/types';
import type { DB } from '../db';
import { newId } from '../db/id';
import { type TestimonialRow, testimonials } from '../db/schema';

export type TestimonialInput = {
  quote: string;
  authorName: string;
  role: string;
  email: string;
};

export function createTestimonialService(db: DB) {
  /** Public submission — forced unpublished / unmoderated. */
  async function submit(input: TestimonialInput): Promise<void> {
    const now = new Date();
    await db.insert(testimonials).values({
      id: newId(),
      quote: input.quote,
      authorName: input.authorName || null,
      role: input.role || null,
      email: input.email || null,
      isPublished: false,
      publishedAt: null,
      sortOrder: 0,
      created: now,
      updated: now,
    });
  }

  /** Published testimonials, sorted (sort_order, then newest published). */
  async function listPublished(): Promise<Testimonial[]> {
    const rows = await db
      .select()
      .from(testimonials)
      .where(
        and(eq(testimonials.isPublished, true), isNull(testimonials.deleted)),
      )
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.publishedAt));
    return rows.map((r) => ({
      quote: r.quote,
      author: r.authorName || null,
      role: r.role || null,
    }));
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  async function listAll(): Promise<TestimonialRow[]> {
    return db
      .select()
      .from(testimonials)
      .where(isNull(testimonials.deleted))
      .orderBy(desc(testimonials.created));
  }

  async function setPublished(id: string, published: boolean): Promise<void> {
    await db
      .update(testimonials)
      .set({
        isPublished: published,
        publishedAt: published ? new Date() : null,
        updated: new Date(),
      })
      .where(eq(testimonials.id, id));
  }

  async function remove(id: string): Promise<void> {
    await db.delete(testimonials).where(eq(testimonials.id, id));
  }

  return { submit, listPublished, listAll, setPublished, remove };
}

export type TestimonialService = ReturnType<typeof createTestimonialService>;
