/**
 * An EmDash `events` entry as the pages and mails read it. The admin stores the
 * start and end as instants (`datetime`, picked in Berlin time); everything
 * downstream keeps the site's one time model (time.ts): a Berlin calendar day plus
 * wall-clock times. Pure: pages pass `getEmDashCollection` data (dates as `Date`),
 * the plugin passes `ctx.content` data (dates as ISO strings).
 */
import type { EventDTO } from './dto'
import { berlinClock, isPast } from './time'

/** One Portable Text block, as far as this site reads it. */
export interface TextBlock {
  _type: string
  children?: Array<{ text?: string }>
}

/** The event as the server holds it: the public DTO plus its rich text and last edit. */
export interface EventRecord extends EventDTO {
  body: TextBlock[]
  updated_at: string
}

type Data = Record<string, unknown>

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const instant = (value: unknown): Date | null => {
  const date = value instanceof Date ? value : typeof value === 'string' && value ? new Date(value) : null

  return date && !Number.isNaN(date.getTime()) ? date : null
}

const wallClock = (date: Date): string => {
  const { minutes } = berlinClock(date)

  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** The blocks' text, paragraphs parted by a blank line (meta descriptions, calendar files, mails). */
export const portableTextToPlain = (blocks: unknown): string =>
  Array.isArray(blocks)
    ? (blocks as TextBlock[])
        .filter(block => block?._type === 'block')
        .map(block => (block.children ?? []).map(child => child.text ?? '').join(''))
        .filter(line => line.trim())
        .join('\n\n')
    : ''

/** A stored event plus the seats its registrations hold. */
export const eventFromEntry = (id: string, slug: string, data: Data, seatsTaken: number): EventRecord => {
  const start = instant(data.starts_at)
  const end = instant(data.ends_at)
  const eventDate = start ? berlinClock(start).day : ''
  const max = Math.max(0, num(data.max_participants) ?? 0)
  const available = Math.max(0, max - seatsTaken)
  const body = Array.isArray(data.description) ? (data.description as TextBlock[]) : []

  return {
    id,
    title: text(data.title),
    slug,
    description: portableTextToPlain(body),
    body,
    event_date: eventDate,
    start_time: start ? wallClock(start) : '',
    end_time: end ? wallClock(end) : '',
    location: text(data.location),
    location_details: text(data.location_details),
    street: text(data.street),
    postal_code: text(data.postal_code),
    city: text(data.city),
    latitude: num(data.latitude),
    longitude: num(data.longitude),
    max_participants: max,
    cost_basis: text(data.cost_basis),
    image_url: null,
    available_spots: available,
    is_full: available <= 0,
    is_past: isPast(eventDate),
    updated_at: instant(data.updatedAt ?? data.updated_at)?.toISOString() ?? '',
  }
}

/** Whether a registration still holds its seat (it has not been cancelled). */
export const holdsASeat = (data: Data): boolean => !instant(data.cancelled_at)
