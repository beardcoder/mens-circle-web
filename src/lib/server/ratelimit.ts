/**
 * In-process fixed-window rate limiting. One long-lived Bun process, so a plain
 * Map is the whole store — but every `key:ip` pair mints an entry, so expired
 * buckets are swept opportunistically to keep the map proportional to active
 * clients rather than to every client since the deploy.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Sweep at most this often. Never affects the limit: an unswept expired bucket
 *  is still treated as expired below. */
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
