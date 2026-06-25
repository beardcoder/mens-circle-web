export const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
};

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const isCoarsePointer = (): boolean =>
  typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(pointer: coarse)').matches;

export const prefersReducedMotion = (): boolean =>
  typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
