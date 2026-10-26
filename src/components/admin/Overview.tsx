import { actions } from 'astro:actions';
import { useState } from 'preact/hooks';

import { button, card, control } from '@lib/ui';

import NextEvent from './NextEvent';
import type { AdminEvent, OverviewData } from './types';
import { AdminHead, Badge, ConfirmDialog, Feedback, shortDate } from './ui';
import { useAdminTask } from './useAdminTask';

export default function Overview({ initial }: { initial: OverviewData }) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('upcoming');
  const [remove, setRemove] = useState<AdminEvent | null>(null);
  const task = useAdminTask();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.events.filter((event) => event.eventDate.slice(0, 10) >= today);
  const next = data.events.find((event) => event.id === data.nextEventId);

  const visible = data.events
    .filter((event) => matchesFilter(event, filter, today))
    .filter((event) =>
      `${event.title} ${event.location} ${event.city} ${shortDate(event.eventDate)}`
        .toLocaleLowerCase('de')
        .includes(search.toLocaleLowerCase('de')),
    )
    .sort((a, b) =>
      filter === 'past' ? b.eventDate.localeCompare(a.eventDate) : a.eventDate.localeCompare(b.eventDate),
    );

  async function refresh() {
    const result = await actions.loadAdminOverview();

    if (result.error) throw new Error(result.error.message);

    setData(result.data);
  }

  return (
    <>
      <AdminHead
        title="Veranstaltungen"
        description={`Kommende Termine: ${upcoming.length} · Entwürfe: ${data.events.filter((event) => !event.isPublished).length}`}
      >
        <button
          type="button"
          disabled={!!task.busy}
          class={button({ variant: 'secondary', size: 'sm' })}
          onClick={() => void task.run('refresh', () => actions.loadAdminOverview(), setData)}
        >
          Aktualisieren
        </button>
        <a href="/admin/events/new" class={button({ size: 'sm' })}>
          Neuer Termin
        </a>
      </AdminHead>
      <Feedback notice={task.notice} />
      {next && <NextEvent event={next} people={data.people} />}
      <section aria-label="Termine durchsuchen">
        <div class="mb-5 grid gap-3 sm:grid-cols-[1fr_15rem]">
          <label class="grid gap-2 text-sm font-semibold">
            Suchen
            <input
              type="search"
              value={search}
              onInput={(event) => setSearch(event.currentTarget.value)}
              placeholder="Titel, Ort oder Datum"
              class={control('sm')}
            />
          </label>
          <label class="grid gap-2 text-sm font-semibold">
            Zeitraum und Status
            <select value={filter} onChange={(event) => setFilter(event.currentTarget.value)} class={control('sm')}>
              <option value="upcoming">Kommende Termine ({upcoming.length})</option>
              <option value="draft">Entwürfe</option>
              <option value="published">Veröffentlicht</option>
              <option value="past">Vergangene Termine</option>
              <option value="all">Alle Termine</option>
            </select>
          </label>
        </div>
        <p role="status" class="mb-3 text-sm text-fg-muted">
          {visible.length} von {data.events.length} Terminen
        </p>
        {!visible.length && (
          <div class="grid justify-items-start gap-3 border border-dashed border-line-strong p-8 text-fg-muted">
            <p>{data.events.length ? 'Keine Termine für diese Auswahl.' : 'Noch keine Termine angelegt.'}</p>
            <a href="/admin/events/new" class={button({ variant: 'secondary', size: 'sm' })}>
              Neuen Termin anlegen
            </a>
          </div>
        )}
        <ul class="grid gap-3" aria-label="Veranstaltungen">
          {visible.map((event) => (
            <li key={event.id} class={`${card} flex flex-wrap items-center justify-between gap-5 p-5`}>
              <div class="min-w-0 flex-[1_1_18rem]">
                <div class="mb-2 flex flex-wrap items-center gap-3">
                  <Badge active={event.isPublished}>{event.isPublished ? 'Veröffentlicht' : 'Entwurf'}</Badge>
                  <span class="text-sm text-fg-muted tabular-nums">
                    {shortDate(event.eventDate)}
                    {event.startTime && ` · ${event.startTime} Uhr`}
                  </span>
                </div>
                <a href={`/admin/events/${event.id}`} class="font-serif text-xl text-fg hover:text-accent">
                  {event.title}
                </a>
                <p class="mt-2 text-sm text-fg-muted">
                  {event.activeCount} / {event.maxParticipants} Plätze belegt{event.city && ` · ${event.city}`}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2 max-sm:w-full">
                <a
                  href={`/admin/events/${event.id}/registrations`}
                  class={button({ variant: 'secondary', size: 'sm' })}
                >
                  Anmeldungen
                </a>
                <a href={`/admin/events/${event.id}`} class={button({ variant: 'secondary', size: 'sm' })}>
                  Bearbeiten
                </a>
                <details class="relative">
                  <summary class="cursor-pointer px-3 py-3 text-sm text-fg-muted hover:text-fg">Mehr</summary>
                  <div class="absolute right-0 z-10 mt-2 grid min-w-52 gap-1 border border-line-strong bg-raised p-2 shadow-overlay">
                    <a
                      class="px-3 py-2 text-sm hover:bg-fg/5"
                      href={`/admin/events/new?from=${encodeURIComponent(event.id)}`}
                    >
                      Duplizieren
                    </a>
                    {event.isPublished && (
                      <a
                        class="px-3 py-2 text-sm hover:bg-fg/5"
                        href={`/event/${event.slug}`}
                        target="_blank"
                        rel="noopener"
                      >
                        Öffentliche Seite öffnen
                      </a>
                    )}
                    <button
                      disabled={!!task.busy}
                      class="px-3 py-2 text-left text-sm hover:bg-fg/5"
                      onClick={() =>
                        void task.run(
                          event.id,
                          () => actions.setEventPublished({ id: event.id, published: !event.isPublished }),
                          refresh,
                        )
                      }
                    >
                      {event.isPublished ? 'Als Entwurf speichern' : 'Veröffentlichen'}
                    </button>
                    <button
                      disabled={!!task.busy}
                      class="px-3 py-2 text-left text-sm text-danger hover:bg-fg/5"
                      onClick={() => setRemove(event)}
                    >
                      Löschen
                    </button>
                  </div>
                </details>
              </div>
            </li>
          ))}
        </ul>
      </section>
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

function matchesFilter(event: AdminEvent, filter: string, today: string) {
  if (filter === 'upcoming') return event.eventDate.slice(0, 10) >= today;

  if (filter === 'past') return event.eventDate.slice(0, 10) < today;

  if (filter === 'draft') return !event.isPublished;

  if (filter === 'published') return event.isPublished;

  return true;
}
