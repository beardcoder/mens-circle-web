import { actions } from 'astro:actions';
import { useState } from 'preact/hooks';

import { button, card } from '@lib/ui';

import { Icon } from './icons';
import type { AdminEvent, OverviewData } from './types';
import {
  ConfirmDialog,
  dateParts,
  EmptyState,
  Feedback,
  iconButton,
  Menu,
  menuItem,
  Meter,
  PageHeader,
  SearchField,
  shortDate,
  StatusPill,
  Tabs,
} from './ui';
import { useAdminTask } from './useAdminTask';

type Filter = 'upcoming' | 'draft' | 'past' | 'all';

export default function EventList({ initial }: { initial: OverviewData }) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [remove, setRemove] = useState<AdminEvent | null>(null);
  const task = useAdminTask();
  const today = new Date().toISOString().slice(0, 10);
  const count = (value: Filter) => data.events.filter((event) => matchesFilter(event, value, today)).length;

  const visible = data.events
    .filter((event) => matchesFilter(event, filter, today))
    .filter((event) =>
      `${event.title} ${event.location} ${event.city} ${shortDate(event.eventDate)}`
        .toLocaleLowerCase('de')
        .includes(search.toLocaleLowerCase('de')),
    )
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));

  async function refresh() {
    const result = await actions.loadAdminOverview();

    if (result.error) throw new Error(result.error.message);

    setData(result.data);
  }

  return (
    <>
      <PageHeader title="Termine" description="Alle Abende, ihre Anmeldungen und ihre Sichtbarkeit.">
        <button
          type="button"
          disabled={!!task.busy}
          class={button({ variant: 'secondary', size: 'sm' })}
          onClick={() => void task.run('refresh', () => actions.loadAdminOverview(), setData)}
        >
          <Icon name="refresh" class="size-4.5" />
          Aktualisieren
        </button>
        <a href="/admin/events/new" class={button({ size: 'sm' })}>
          <Icon name="plus" class="size-4.5" />
          Neuer Termin
        </a>
      </PageHeader>
      <Feedback notice={task.notice} />
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Termine filtern"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'upcoming', label: 'Kommend', count: count('upcoming') },
            { value: 'draft', label: 'Entwürfe', count: count('draft') },
            { value: 'past', label: 'Vergangen', count: count('past') },
            { value: 'all', label: 'Alle', count: data.events.length },
          ]}
        />
        <SearchField
          label="Termine durchsuchen"
          placeholder="Titel, Ort oder Datum"
          value={search}
          onInput={setSearch}
        />
      </div>
      <p role="status" class="sr-only">
        {visible.length} von {data.events.length} Terminen
      </p>
      {visible.length ? (
        <ul class={`${card} divide-y divide-line`} aria-label="Termine">
          {visible.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              past={event.eventDate.slice(0, 10) < today}
              busy={!!task.busy}
              onPublish={() =>
                void task.run(
                  event.id,
                  () => actions.setEventPublished({ id: event.id, published: !event.isPublished }),
                  refresh,
                )
              }
              onRemove={() => setRemove(event)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          action={
            <a href="/admin/events/new" class={button({ variant: 'secondary', size: 'sm' })}>
              Neuen Termin anlegen
            </a>
          }
        >
          {data.events.length ? 'Keine Termine für diese Auswahl.' : 'Noch keine Termine angelegt.'}
        </EmptyState>
      )}
      {remove && (
        <ConfirmDialog
          title="Termin löschen?"
          actionLabel="Termin löschen"
          danger
          busy={!!task.busy}
          error={task.notice?.tone === 'error' ? task.notice.text : undefined}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            const result = await task.run('delete', () => actions.deleteEvent({ id: remove.id }), refresh);

            if (result) setRemove(null);
          }}
        >
          <p>„{remove.title}“ wird ausgeblendet. Bestehende Anmeldungen bleiben gespeichert.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

function EventRow({
  event,
  past,
  busy,
  onPublish,
  onRemove,
}: {
  event: AdminEvent;
  past: boolean;
  busy: boolean;
  onPublish: () => void;
  onRemove: () => void;
}) {
  const date = dateParts(event.eventDate);

  return (
    <li class="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 p-4 sm:px-5 md:grid-cols-[3.5rem_minmax(0,1fr)_11rem_auto]">
      <div class={`grid justify-items-center leading-none ${past ? 'text-fg-muted' : ''}`}>
        <span class="text-xs font-semibold text-fg-muted uppercase">{date.weekday}</span>
        <span class="mt-1 text-2xl font-semibold tabular-nums">{date.day}</span>
        <span class="mt-1 text-xs text-fg-muted">{date.month}</span>
      </div>
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a href={`/admin/events/${event.id}`} class="truncate font-semibold text-fg hover:text-accent">
            {event.title}
          </a>
          <StatusPill tone={event.isPublished ? 'success' : 'muted'}>
            {event.isPublished ? 'Veröffentlicht' : 'Entwurf'}
          </StatusPill>
        </div>
        <p class="mt-1 truncate text-sm text-fg-muted">
          {event.startTime ? `${event.startTime} Uhr` : 'Ohne Uhrzeit'}
          {event.location && ` · ${event.location}`}
          {event.city && ` · ${event.city}`}
        </p>
      </div>
      <a
        href={`/admin/events/${event.id}/registrations`}
        class="col-span-2 col-start-2 grid gap-1.5 text-sm hover:text-accent md:col-span-1 md:col-start-auto"
      >
        <span class="flex justify-between gap-2 tabular-nums">
          <span class="text-fg-muted">Plätze</span>
          <span>
            {event.activeCount} / {event.maxParticipants}
          </span>
        </span>
        <Meter value={event.activeCount} max={event.maxParticipants} label={`Plätze belegt: ${event.title}`} />
      </a>
      <div class="col-start-3 row-start-1 flex items-center gap-1 md:col-start-4">
        <a
          href={`/admin/events/${event.id}/registrations`}
          class={`${iconButton} max-sm:hidden`}
          aria-label="Anmeldungen"
          title="Anmeldungen"
        >
          <Icon name="users" />
        </a>
        <a
          href={`/admin/events/${event.id}`}
          class={`${iconButton} max-sm:hidden`}
          aria-label="Bearbeiten"
          title="Bearbeiten"
        >
          <Icon name="edit" />
        </a>
        <Menu label={`Aktionen für ${event.title}`}>
          <a class={`${menuItem} sm:hidden`} href={`/admin/events/${event.id}/registrations`}>
            <Icon name="users" class="size-4.5 text-fg-muted" />
            Anmeldungen
          </a>
          <a class={`${menuItem} sm:hidden`} href={`/admin/events/${event.id}`}>
            <Icon name="edit" class="size-4.5 text-fg-muted" />
            Bearbeiten
          </a>
          <a class={menuItem} href={`/admin/events/new?from=${encodeURIComponent(event.id)}`}>
            <Icon name="copy" class="size-4.5 text-fg-muted" />
            Duplizieren
          </a>
          {event.isPublished && (
            <a class={menuItem} href={`/event/${event.slug}`} target="_blank" rel="noopener">
              <Icon name="external" class="size-4.5 text-fg-muted" />
              Öffentliche Seite öffnen
            </a>
          )}
          <button type="button" disabled={busy} class={menuItem} onClick={onPublish}>
            <Icon name={event.isPublished ? 'eyeOff' : 'eye'} class="size-4.5 text-fg-muted" />
            {event.isPublished ? 'Als Entwurf speichern' : 'Veröffentlichen'}
          </button>
          <button type="button" disabled={busy} class={`${menuItem} text-danger`} onClick={onRemove}>
            <Icon name="trash" class="size-4.5" />
            Löschen
          </button>
        </Menu>
      </div>
    </li>
  );
}

function matchesFilter(event: AdminEvent, filter: Filter, today: string) {
  if (filter === 'upcoming') return event.eventDate.slice(0, 10) >= today;

  if (filter === 'past') return event.eventDate.slice(0, 10) < today;

  if (filter === 'draft') return !event.isPublished;

  return true;
}
