/** Bound recipient work, not just individual HTTP requests. Failures never stop the queue. */
export const settleWithConcurrency = async <T, R>(
  items: readonly T[],
  work: (item: T, index: number) => Promise<R>,
  concurrency = 4,
): Promise<PromiseSettledResult<R>[]> => {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive integer');
  }
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await work(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
};
