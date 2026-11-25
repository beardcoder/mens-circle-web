import type { APIContext } from 'astro'

import type { PublicEvent, PublicEvents } from '@components/event/types'
import type { EventDTO, TestimonialDTO } from '@lib/shared/dto'
import { dateStatus, eventView, splitFee } from '@lib/shared/event-status'

import { fetchTestimonialsState, fetchUpcomingEventsState } from './content'

/**
 * Every cached public response shows CMS content, tagged with the collection names:
 * EmDash purges those tags itself when an entry is published, changed or trashed.
 */
const PUBLIC_TAGS = ['events', 'registrations', 'testimonials']

/**
 * Route-cache lifetime of public pages and JSON: five minutes fresh, five more served
 * while a re-render runs. Every change purges the tags at once, so the lifetime only
 * bounds what changes with the clock (an evening passing).
 */
export const PUBLIC_CACHE = { maxAge: 300, swr: 300, tags: PUBLIC_TAGS }

/** Called by the public forms after a registration took a seat. */
export const purgePublicCache = ({ cache }: Pick<APIContext, 'cache'>): Promise<void> =>
  cache.invalidate({ tags: PUBLIC_TAGS })

export const publicEvent = (event: EventDTO): PublicEvent => ({
  id: event.id,
  slug: event.slug,
  view: eventView(event, 'Nächster Termin'),
  availableSpots: event.available_spots,
  maxParticipants: event.max_participants,
  isPast: event.is_past,
})

/** Upcoming dates for home and /event; `null` when they cannot be read, never "no date". */
export async function readPublicEvents(): Promise<PublicEvents | null> {
  const result = await fetchUpcomingEventsState()

  if (result.status === 'unavailable') return null

  return {
    fee: splitFee(result.events[0]?.cost_basis),
    status: result.status,
    events: result.events.map(publicEvent),
    next: dateStatus(result.status, result.events[0] ?? null).next,
  }
}

/** Approved testimonials in curated order; `null` when they cannot be read. */
export async function readPublicTestimonials(): Promise<TestimonialDTO[] | null> {
  const result = await fetchTestimonialsState(200)

  return result.status === 'ok' ? result.testimonials : null
}
