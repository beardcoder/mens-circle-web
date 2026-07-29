/**
 * In-process fixed-window rate limiting.
 *
 * The Bun server is a single long-lived process, so a plain Map is the whole
 * store — no Redis, no extra service. That also means it must not grow without
 * bound: every distinct `key:ip` pair mints an entry, and a crawler or a spam
 * wave walks through thousands of source addresses. Expired buckets are
 * therefore swept opportunistically, which keeps the map proportional to
 * *currently active* clients instead of to every client seen since the deploy.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Sweep at most this often. A sweep is O(size); at the volumes this site sees,
 * once a minute costs far less than the memory an unswept map would hold. The
 * interval never affects the limit itself — an expired bucket that hasn't been
 * swept yet is still treated as expired below.
 */
const SWEEP_INTERVAL_MS = 60_000;
let nextSweepAt = 0;

export const rateLimit = (key: string, ip: string, maxRequests: number, windowSeconds: number): boolean => {
  const id = `${key}:${ip}`;
  const now = Date.now();

  if (now >= nextSweepAt) {
    for (const [bucketId, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(bucketId);
    }
    nextSweepAt = now + SWEEP_INTERVAL_MS;
  }

  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  if (bucket.count >= maxRequests) return false;
  bucket.count++;
  return true;
};

export const clientIp = (request: Request, fallback = 'unknown'): string => {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || fallback;
};
