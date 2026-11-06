/** The shapes public data takes between the server and the pages. */

/** Public event shape. */
export interface EventDTO {
  id: string;
  title: string;
  slug: string;
  description: string;
  event_date: string; // calendar day, "2026-11-12" (lib/shared/time.ts)
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location: string;
  location_details: string;
  street: string;
  postal_code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  max_participants: number;
  cost_basis: string;
  image_url: string | null;
  available_spots: number;
  is_full: boolean;
  is_past: boolean;
}

export interface TestimonialDTO {
  quote: string;
  author: string | null;
  role: string | null;
}
