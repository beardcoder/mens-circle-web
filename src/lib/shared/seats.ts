/**
 * How full the circle is, for the capacity bar under a date and in the
 * registration panel. Shared by server and client markup, so it imports nothing.
 */

/** Taken seats as a share of all seats (0–1), or `null` when there is nothing to show (a past evening, no seats). */
export const seatFill = (seats: { total: number; free: number } | null): number | null => {
  if (!seats || seats.total < 1) return null;

  const free = Math.min(Math.max(seats.free, 0), seats.total);

  return (seats.total - free) / seats.total;
};
