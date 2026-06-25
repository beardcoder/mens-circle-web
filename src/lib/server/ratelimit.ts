type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export const rateLimit = (key: string, ip: string, maxRequests: number, windowSeconds: number): boolean => {
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
};

export const clientIp = (request: Request, fallback = 'unknown'): string => {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || fallback;
};
