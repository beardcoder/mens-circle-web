import type { DateStatus, SummaryView } from '@lib/event-status';

/** Only fields already displayed publicly; never addresses or participant data. */
export interface PublicEvent {
  id: string;
  slug: string;
  view: SummaryView;
  availableSpots: number;
  maxParticipants: number;
  isPast: boolean;
}

export interface PublicEvents {
  status: 'scheduled' | 'none';
  events: PublicEvent[];
  next: DateStatus['next'];
  fee: { main: string; note: string };
}
