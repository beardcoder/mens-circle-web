export const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
};

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * FNV-1a over a string, base36.
 *
 * A cache key, never a signature: it is what turns "everything this share card
 * draws" into the `?v=` token on the card URL, the card's ETag and the key of
 * the in-process render cache. Those three have to agree — when they were three
 * hashes they could drift, and a drifting card token is exactly the bug the
 * token exists to prevent.
 */
export const fnv1a = (source: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

export const isCoarsePointer = (): boolean =>
  typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(pointer: coarse)').matches;

export const prefersReducedMotion = (): boolean =>
  typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
