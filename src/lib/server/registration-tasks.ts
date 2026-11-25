/* eslint-disable no-console */
/**
 * What the plugin does with registrations outside a request: the reminder pass
 * (every quarter hour, reminder-window.ts decides who is due) and the deletion of
 * old registrations (daily). Both work on `Store`, the slice of EmDash's plugin
 * context they need, so tests can hand in a fake.
 */
import { eventFromEntry, type EventRecord, holdsASeat } from '../shared/event-entry'
import { addDays, berlinClock, todayBerlin } from '../shared/time'
import { cancelUrlFor } from './cancel-token'
import { config } from './config'
import { eventReminder, type Message, type Participant } from './mail'
import { candidateDays, reminderDue } from './reminder-window'

export interface Item {
  id: string
  slug: string | null
  status: string
  data: Record<string, unknown>
  updatedAt: string
}

type Filters = Record<string, string | number | null | { gte?: string, lt?: string } | { in: string[] }>

/** The plugin context as far as these tasks read it (`ctx.content`, `ctx.email`). */
export interface Store {
  content: {
    get(collection: string, id: string): Promise<Item | null>
    list(
      collection: string,
      options: { limit?: number, cursor?: string, where?: { status?: string, fieldFilters?: Filters } },
    ): Promise<{ items: Item[], cursor?: string, hasMore?: boolean }>
    create(collection: string, data: Record<string, unknown>): Promise<Item>
    update(collection: string, id: string, data: Record<string, unknown>): Promise<Item>
    delete(collection: string, id: string): Promise<boolean>
    getVersioned(collection: string, id: string): Promise<{ _rev: string } | null>
    publish(collection: string, id: string, options: { _rev: string }): Promise<unknown>
  }
  email?: { send(message: Message): Promise<void> }
}

/** Every entry that matches, across pages. */
const listAll = async (
  store: Store,
  collection: string,
  where: { status?: string, fieldFilters?: Filters },
): Promise<Item[]> => {
  const items: Item[] = []
  let cursor: string | undefined

  do {
    const page = await store.content.list(collection, { limit: 100, cursor, where })

    items.push(...page.items)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  return items
}

export const eventOf = (item: Item, seatsTaken: number): EventRecord =>
  eventFromEntry(item.id, item.slug ?? '', { ...item.data, updatedAt: item.updatedAt }, seatsTaken)

const participantOf = (item: Item): Participant => ({
  firstName: String(item.data.first_name ?? ''),
  lastName: String(item.data.last_name ?? ''),
  email: String(item.data.email ?? ''),
  phone: String(item.data.phone ?? ''),
})

/** The registrations of one event that still hold a seat. */
export const activeRegistrations = async (store: Store, eventId: string): Promise<Item[]> =>
  (await listAll(store, 'registrations', { fieldFilters: { event: eventId } })).filter(item => holdsASeat(item.data))

/** Sends a message if a mail provider is configured; true when it left. */
export const deliver = async (store: Store, message: Message): Promise<boolean> => {
  if (!store.email) {
    console.error('[mail] no email provider configured (EmDash: Settings → Email)')

    return false
  }

  try {
    await store.email.send(message)

    return true
  }
  catch (err) {
    console.error('[mail] delivery failed', message.subject, String(err))

    return false
  }
}

/** One idempotent pass: every seat of a published event in its reminder window that has none yet. */
export async function runReminders(store: Store, now: Date = new Date()): Promise<number> {
  const { from, to } = candidateDays(now)

  const events = await listAll(store, 'events', {
    status: 'published',
    // A day early on both ends: the window is in Berlin days, the field holds UTC instants.
    fieldFilters: { starts_at: { gte: `${addDays(from, -1)}T00:00:00.000Z`, lt: `${addDays(to, 1)}T00:00:00.000Z` } },
  })

  let sent = 0

  for (const item of events) {
    const event = eventOf(item, 0)
    const kind = reminderDue(event.event_date, event.start_time, now)

    if (!kind) continue

    for (const registration of await activeRegistrations(store, item.id)) {
      if (registration.data.reminder_sent_at) continue

      const cancelUrl = await cancelUrlFor(registration.id, event.event_date)
      const message = eventReminder(event, participantOf(registration), kind === 'today', cancelUrl)

      if (!(await deliver(store, message))) continue

      await store.content.update('registrations', registration.id, { reminder_sent_at: now.toISOString() })
      sent++
    }
  }

  return sent
}

const ANONYMOUS_DOMAIN = '@anonymised.invalid'

/**
 * Data minimisation: `RETENTION_DAYS` after an event's day its registrations lose
 * name, address and phone and move to the trash (emptying the trash in the admin
 * removes them for good). Voices carry no address at all.
 */
export async function runRetention(
  store: Store,
  now: Date = new Date(),
  days = config.RETENTION_DAYS,
): Promise<number> {
  const cutoff = addDays(todayBerlin(now), -days)
  const expired = await listAll(store, 'events', { fieldFilters: { starts_at: { lt: `${cutoff}T00:00:00.000Z` } } })
  let done = 0

  for (const event of expired) {
    if (berlinClock(new Date(String(event.data.starts_at))).day >= cutoff) continue

    for (const registration of await listAll(store, 'registrations', { fieldFilters: { event: event.id } })) {
      await store.content.update('registrations', registration.id, {
        first_name: 'Anonym',
        last_name: 'Anonym',
        email: `${registration.id}${ANONYMOUS_DOMAIN}`,
        phone: '',
      })
      await store.content.delete('registrations', registration.id)
      done++
    }
  }

  console.info('[retention]', JSON.stringify({ registrations: done }))

  return done
}
