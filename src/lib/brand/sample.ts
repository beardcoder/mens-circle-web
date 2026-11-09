/** A date to show components with in the styleguide: never published, never stored. */
import type { EventDTO } from '../shared/dto';

export const SAMPLE_EVENT: EventDTO = {
  id: 'sample',
  title: 'Männerkreis',
  slug: 'beispiel',
  description: '',
  event_date: '2026-11-20',
  start_time: '19:30',
  end_time: '21:30',
  location: 'Gemeindesaal',
  location_details: '',
  street: '',
  postal_code: '',
  city: 'Geiselhöring',
  latitude: null,
  longitude: null,
  max_participants: 7,
  cost_basis: 'Spendenbasis',
  image_url: null,
  available_spots: 3,
  is_full: false,
  is_past: false,
};
