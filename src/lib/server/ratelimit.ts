/** In-process fixed-window rate limiting. */
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

/**
 * Who sits in front of the app and may name the visitor's address. `cloudflare`:
 * trust `CF-Connecting-IP`, which Cloudflare sets and overwrites (only true while the
 * origin is reachable through Cloudflare alone). `none`: the socket's peer address.
 * `X-Forwarded-For` is never read: its first entry is whatever the client sent.
 */
export type TrustedProxy = 'cloudflare' | 'none';

export const parseTrustedProxy = (value: string): TrustedProxy => (value === 'cloudflare' ? 'cloudflare' : 'none');

/** The address a rate-limit bucket is keyed by. */
export const clientIp = (request: Request, clientAddress: string | undefined, trust: TrustedProxy): string => {
  if (trust === 'cloudflare') {
    const cf = request.headers.get('cf-connecting-ip')?.trim();

    if (cf) return cf;
  }

  return clientAddress || 'unknown';
};

/** Astro's `clientAddress` throws when the adapter cannot tell; that is not an error here. */
export const peerAddress = (context: { clientAddress: string }): string | undefined => {
  try {
    return context.clientAddress;
  } catch {
    return undefined;
  }
};
