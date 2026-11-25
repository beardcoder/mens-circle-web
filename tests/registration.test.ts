import { beforeEach, expect, test } from 'bun:test'

import { config } from '../src/lib/server/config'
import type { Message } from '../src/lib/server/mail'
import { register } from '../src/lib/server/registration'
import { type Item, runReminders, runRetention, type Store } from '../src/lib/server/registration-tasks'
import { eventFromEntry, portableTextToPlain } from '../src/lib/shared/event-entry'

// The plugin's logic against an in-memory stand-in for EmDash's plugin context.

config.CANCEL_LINK_SECRET = 'registration-test-secret-of-32-characters'
config.MAIL_ADMIN_ADDRESS = 'admin@example.invalid'

let items: Map<string, Item & { collection: string, trashed?: boolean }>
let sent: Message[]
let next = 0

const matches = (item: Item, filters: Record<string, unknown> = {}): boolean =>
  Object.entries(filters).every(([field, rule]) => {
    const value = item.data[field]

    if (rule && typeof rule === 'object') {
      const { gte, lt } = rule as { gte?: string, lt?: string }

      return (gte === undefined || String(value) >= gte) && (lt === undefined || String(value) < lt)
    }

    return value === rule
  })

const store: Store = {
  content: {
    get: async (_collection, id) => (items.get(id)?.trashed ? null : (items.get(id) ?? null)),
    list: async (collection, { where }) => ({
      items: [...items.values()].filter(
        item =>
          item.collection === collection
          && !item.trashed
          && (!where?.status || item.status === where.status)
          && matches(item, where?.fieldFilters),
      ),
      hasMore: false,
    }),
    create: async (collection, data) => {
      const item = { id: `id${++next}`, slug: null, status: 'draft', data, updatedAt: '', collection }

      items.set(item.id, item)

      return item
    },
    update: async (_collection, id, data) => {
      const item = items.get(id)!

      item.data = { ...item.data, ...data }

      return item
    },
    delete: async (_collection, id) => {
      items.get(id)!.trashed = true

      return true
    },
    getVersioned: async () => ({ _rev: 'r' }),
    publish: async (_collection, id) => {
      items.get(id)!.status = 'published'
    },
  },
  email: { send: async message => void sent.push(message) },
}

const addEvent = (id: string, startsAt: string, max = 2, status = 'published') =>
  items.set(id, {
    id,
    slug: id,
    status,
    collection: 'events',
    updatedAt: '',
    data: { title: 'Männerkreis', starts_at: startsAt, max_participants: max, city: 'Straubing' },
  })

const signUp = (first: string, eventId = 'ev') =>
  register(store, { event_id: eventId, first_name: first, last_name: 'Test', email: `${first}@example.invalid` })

beforeEach(() => {
  items = new Map()
  sent = []
  addEvent('ev', '2099-01-01T18:00:00.000Z')
})

test('a sign-up is stored published and mails the participant and the admin', async () => {
  const { message } = await signUp('Anton')
  const [registration] = [...items.values()].filter(item => item.collection === 'registrations')

  expect(message).toContain('Anton')
  expect(registration.status).toBe('published')
  expect(registration.data).toMatchObject({ first_name: 'Anton', email: 'anton@example.invalid', event: 'ev' })
  expect(sent.map(m => m.to)).toEqual(['anton@example.invalid', 'admin@example.invalid'])
  expect(sent[0].html).toContain('/anmeldung/absagen?token=')
  expect(sent[0].text).toContain('Männerkreis: Donnerstag, 1. Januar 2099, 19:00 Uhr')
  expect(sent[1].subject).toBe('Neue Anmeldung: Männerkreis')
})

test('the same address twice, a full evening, a past or hidden one are refused', async () => {
  await signUp('Anton')
  await expect(signUp('Anton')).rejects.toThrow('bereits')
  await signUp('Bert')
  await expect(signUp('Carl')).rejects.toThrow('voll')

  addEvent('old', '2020-01-01T18:00:00.000Z')
  await expect(signUp('Dora', 'old')).rejects.toThrow('stattgefunden')
  addEvent('draft', '2099-01-01T18:00:00.000Z', 8, 'draft')
  await expect(signUp('Emil', 'draft')).rejects.toThrow('nicht verfügbar')
})

test('a cancelled seat is free again', async () => {
  await signUp('Anton')
  await signUp('Bert')
  const anton = [...items.values()].find(item => item.data.first_name === 'Anton')!

  anton.data.cancelled_at = new Date().toISOString()
  expect((await signUp('Carl')).message).toContain('Carl')
})

test('reminders go out once, in the window, to seats that are not cancelled', async () => {
  addEvent('soon', '2026-11-25T18:00:00.000Z')
  await signUp('Anton', 'soon')
  await signUp('Bert', 'soon');
  [...items.values()].find(item => item.data.first_name === 'Bert')!.data.cancelled_at = '2026-11-20T10:00:00.000Z'
  sent = []

  // 19:00 in Berlin the evening before: "morgen".
  const evening = new Date('2026-11-24T18:00:00.000Z')

  expect(await runReminders(store, evening)).toBe(1)
  expect(sent[0].subject).toBe('Erinnerung: Männerkreis ist morgen!')
  expect(await runReminders(store, evening)).toBe(0)
  // 03:00 at night: nothing.
  expect(await runReminders(store, new Date('2026-11-25T02:00:00.000Z'))).toBe(0)
})

test('registrations of an evening past the retention are anonymised and trashed', async () => {
  addEvent('old', '2026-09-01T17:00:00.000Z')
  items.set('r-old', {
    id: 'r-old',
    slug: null,
    status: 'published',
    collection: 'registrations',
    updatedAt: '',
    data: { first_name: 'Alt', last_name: 'Teil', email: 'alt@example.invalid', phone: '0170', event: 'old' },
  })
  await signUp('Neu')

  expect(await runRetention(store, new Date('2026-11-24T12:00:00.000Z'), 30)).toBe(1)
  const old = items.get('r-old')!

  expect(old.trashed).toBe(true)
  expect(old.data).toMatchObject({ first_name: 'Anonym', phone: '', email: 'r-old@anonymised.invalid' })
  expect([...items.values()].find(item => item.data.first_name === 'Neu')?.trashed).toBeUndefined()
})

test('an entry becomes the site’s event shape in Berlin time', () => {
  const body = [
    { _type: 'block', children: [{ text: 'Erster Absatz.' }] },
    { _type: 'image' },
    { _type: 'block', children: [{ text: 'Zweiter ' }, { text: 'Absatz.' }] },
  ]

  const event = eventFromEntry(
    'x',
    '2026-07-03',
    {
      title: ' Kreis ',
      starts_at: new Date('2026-07-03T17:30:00.000Z'),
      ends_at: '2026-07-03T20:00:00.000Z',
      max_participants: 8,
      description: body,
    },
    3,
  )

  expect(event).toMatchObject({
    title: 'Kreis',
    event_date: '2026-07-03',
    start_time: '19:30',
    end_time: '22:00',
    available_spots: 5,
    is_full: false,
    description: 'Erster Absatz.\n\nZweiter Absatz.',
  })
  expect(portableTextToPlain(undefined)).toBe('')
})
