import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

import { openDatabase, useDatabase } from '../src/lib/server/db';
import { testimonials } from '../src/lib/server/db/schema';
import { moveTestimonial } from '../src/lib/server/testimonials';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

test('voices move one place at a time and keep a clean order', async () => {
  const db = useDatabase(openDatabase(':memory:', { migrationsFolder }));

  await db.insert(testimonials).values([
    { id: 'a', quote: 'A', sortOrder: 0, createdAt: '2026-01-03' },
    { id: 'b', quote: 'B', sortOrder: 0, createdAt: '2026-01-02' },
    { id: 'c', quote: 'C', sortOrder: 5, createdAt: '2026-01-01' },
    { id: 'gone', quote: 'X', sortOrder: 1, deleted: '2026-01-04' },
  ]);

  const ids = (order: { id: string }[] | null) => order?.map((row) => row.id);

  expect(ids(moveTestimonial('c', 'up'))).toEqual(['a', 'c', 'b']);
  expect(moveTestimonial('a', 'up')?.map((row) => row.sortOrder)).toEqual([10, 20, 30]);
  expect(ids(moveTestimonial('a', 'down'))).toEqual(['c', 'a', 'b']);
  expect(ids(moveTestimonial('b', 'down'))).toEqual(['c', 'a', 'b']);
  expect(moveTestimonial('gone', 'up')).toBeNull();
});
