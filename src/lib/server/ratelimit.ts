/**
 * Tiny in-memory rate limiter (server-only) for the public POST endpoints.
 * Replaces PocketBase's built-in per-route rate limits. Fixed-window per
 * (key, clientIp); fine for a single long-lived Bun process.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Returns true when the request is allowed; false when the limit is exceeded. */
export function rateLimit(key: string, ip: string, maxRequests: number, windowSeconds: number): boolean {
  const id = `${key}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  if (bucket.count >= maxRequests) return false;
  bucket.count++;
  return true;
}

/** Best-effort client IP from the forwarded headers (set by the Bun edge). */
export function clientIp(request: Request, fallback = 'unknown'): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || fallback;
}
