/**
 * Public event shape. Capacity values are computed server-side, so the client
 * never sees raw registration data.
 */
export interface EventDTO {
  id: string;
  title: string;
  slug: string;
  description: string;
  event_date: string; // ISO timestamp
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

export interface Testimonial {
  quote: string;
  author: string | null;
  role: string | null;
}

declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, unknown>) => void };
  }
}
