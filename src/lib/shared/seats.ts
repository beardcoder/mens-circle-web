/**
 * How full the circle is, for the seat ring under a date and in the
 * registration panel. Shared by server and client markup, so it imports nothing.
 */

/** Taken seats as a share of all seats (0–1), or `null` when there is nothing to show (a past evening, no seats). */
export const seatFill = (seats: { total: number; free: number } | null): number | null => {
  if (!seats || seats.total < 1) return null;

  const free = Math.min(Math.max(seats.free, 0), seats.total);

  return (seats.total - free) / seats.total;
};

/** One chair on the ring: its centre in a 100 × 100 box and whether someone sits there. */
export interface SeatDot {
  x: number;
  y: number;
  taken: boolean;
}

/**
 * The chairs of the circle on a ring (the seat ring): `total` dots evenly round a
 * circle of radius `radius` about the box's centre, the first at the top, taken
 * ones first, clockwise. `r` is the dot's radius, smaller the more chairs share
 * the ring. `null` when there is nothing to show.
 */
export const seatDots = (
  seats: { total: number; free: number } | null,
  radius = 40,
): { dots: SeatDot[]; r: number; free: number } | null => {
  const fill = seatFill(seats);

  if (fill === null || !seats) return null;

  const total = Math.min(seats.total, 48);
  const taken = Math.round(fill * total);
  const round = (n: number) => Math.round(n * 100) / 100;

  const dots = Array.from({ length: total }, (_, i) => {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2;

    return { x: round(50 + radius * Math.cos(angle)), y: round(50 + radius * Math.sin(angle)), taken: i < taken };
  });

  const spacing = (2 * Math.PI * radius) / total;

  return { dots, r: round(Math.min(6.5, spacing * 0.3)), free: seats.total - Math.round(fill * seats.total) };
};
