/**
 * The circle's seats as points on a ring, for the date seal and the registration
 * panel. Shared by server and client markup, so it imports nothing.
 */

interface Seat {
  x: string;
  y: string;
  free: boolean;
}

/** Drawn only for a circle's size; outside it the words say enough. */
const MIN_SEATS = 2;
const MAX_SEATS = 24;

/** The ring sits in a 0 0 80 80 viewBox, leaving room inside for the date seal. */
const CENTRE = 40;
const RADIUS = 35;

/** One point per seat, from the top clockwise: the taken seats first, then the free ones. */
export const seatRing = (seats: { total: number; free: number } | null): Seat[] => {
  const total = seats && seats.total >= MIN_SEATS && seats.total <= MAX_SEATS ? seats.total : 0;
  const taken = total - Math.min(Math.max(seats?.free ?? 0, 0), total);

  return Array.from({ length: total }, (_, i) => {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2;

    return {
      x: (CENTRE + RADIUS * Math.cos(angle)).toFixed(2),
      y: (CENTRE + RADIUS * Math.sin(angle)).toFixed(2),
      free: i >= taken,
    };
  });
};
