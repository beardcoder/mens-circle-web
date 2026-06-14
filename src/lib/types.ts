/**
 * Shared type definitions for the Männerkreis frontend.
 */

/** Standard response contract for all form-handling API routes. */
export interface ApiResponse {
  success: boolean;
  message: string;
}

/** Calendar event payload used by the add-to-calendar util. */
export interface EventData {
  title: string;
  description: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:MM
}

/**
 * Public event shape returned by the EmDash API routes
 * `GET /api/public/events/next` and `GET /api/public/events/{slug}`.
 * Capacity values are computed server-side (registration counts are not
 * exposed to the public), so the client never sees raw registration data.
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

/** Payload for the event registration form → POST /api/event/register */
export interface RegistrationPayload {
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  privacy: boolean;
  /** Honeypot anti-spam field — real users leave it empty. */
  website?: string;
}

/** Payload for the testimonial form → POST /api/testimonial/submit */
export interface TestimonialPayload {
  quote: string;
  author_name: string | null;
  role: string | null;
  email: string;
  privacy: boolean;
  /** Honeypot anti-spam field — real users leave it empty. */
  website?: string;
}

declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, unknown>) => void };
    eventData?: EventData;
  }
}
