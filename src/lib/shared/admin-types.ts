/** The data the admin workspaces receive from their actions; server and UI share it. */
import type { EventInput } from '../event-input';

export type RegistrationStatus = 'registered' | 'waitlist' | 'cancelled' | 'attended';

/** One registration as the admin workspace lists it. */
export interface RegistrationRow {
  id: string;
  status: RegistrationStatus;
  registeredAt: string | null;
  cancelledAt: string | null;
  confirmationSentAt: string | null;
  reminderSentAt: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Typed at sign-up but not stored on the participant (see `upsertParticipant`). */
  submittedFirstName: string | null;
  submittedLastName: string | null;
  submittedPhone: string | null;
}

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

export interface EventsData {
  events: AdminEvent[];
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
