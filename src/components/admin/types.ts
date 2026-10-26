import type { EventInput } from '@lib/event-input';
import type { RegistrationRow } from '@lib/server/registrations';

export type { RegistrationRow };
export type RegistrationStatus = RegistrationRow['status'];
export type EventFormData = (Partial<EventInput> & { id?: string }) | null;

export interface AdminEvent {
  id: string;
  title: string;
  slug: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  city: string;
  maxParticipants: number;
  activeCount: number;
  isPublished: boolean;
}

export interface OverviewData {
  events: AdminEvent[];
  nextEventId: string | null;
  people: RegistrationRow[];
  /** Submitted voices still waiting for moderation. */
  pendingTestimonials: number;
}

export interface RegistrationsData {
  eventId: string;
  eventTitle: string;
  maxParticipants: number;
  registrations: RegistrationRow[];
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  role: string;
  email: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
}
