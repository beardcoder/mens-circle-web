/**
 * Shared helpers.
 */

/**
 * Validates an email format. Slightly stricter than the lookahead-only regex:
 * requires a non-empty local part with at least one character before `@`, a
 * domain with at least one dot, and TLD chars only after the final dot.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();

  if (trimmed.length === 0 || trimmed.length > 254) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

/**
 * Clamp a number between `min` and `max` (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Detect a coarse pointer (touch / pen) device — used to surface native
 * map / dial UI on phones and tablets.
 */
export function isCoarsePointer(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * Reduced-motion preference, evaluated at call time so toggling the OS
 * setting takes effect on the next animation.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
