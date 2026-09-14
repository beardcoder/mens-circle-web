import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { settleWithConcurrency } from '../src/lib/server/concurrency';

test('recipient pool defaults to four, preserves order and isolates sync/async failures', async () => {
  let active = 0;
  let peak = 0;
  const visited: number[] = [];
  const results = await settleWithConcurrency(
    Array.from({ length: 13 }, (_, i) => i),
    (item) => {
      visited.push(item);
      if (item === 1) throw new Error('synchronous failure');
      return (async () => {
        peak = Math.max(peak, ++active);
        try {
          await new Promise((resolve) => setTimeout(resolve, 2));
          if (item === 5) throw new Error('asynchronous failure');
          return item === 6 ? false : item;
        } finally {
          active--;
        }
      })();
    },
  );
  expect(peak).toBe(4);
  expect(active).toBe(0);
  expect(visited).toHaveLength(13);
  expect(results).toHaveLength(13);
  expect(results[1].status).toBe('rejected');
  expect(results[5].status).toBe('rejected');
  expect(results[6]).toEqual({ status: 'fulfilled', value: false });
  expect(results[12]).toEqual({ status: 'fulfilled', value: 12 });
});

test('empty queues, custom limits and invalid limits', async () => {
  expect(await settleWithConcurrency([], async () => true)).toEqual([]);
  const order: number[] = [];
  await settleWithConcurrency(
    [1, 2, 3],
    async (n) => {
      order.push(n);
    },
    1,
  );
  expect(order).toEqual([1, 2, 3]);
  for (const limit of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(
      settleWithConcurrency([], async () => true, limit),
      RangeError,
    );
  }
});
