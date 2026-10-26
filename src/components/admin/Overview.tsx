import { actions } from 'astro:actions';
import { useState } from 'preact/hooks';

import { button, card } from '@lib/ui';

import { Icon, type IconName } from './icons';
import NextEvent from './NextEvent';
import type { AdminEvent, OverviewData } from './types';
import {
  dateParts,
  EmptyState,
  Feedback,
  holdsSeat,
  Meter,
  needsConfirmation,
  PageHeader,
  Stat,
  StatusPill,
} from './ui';
import { useAdminTask } from './useAdminTask';

interface Todo {
  href: string;
  icon: IconName;
  text: string;
}

/** The dashboard: what is next, what is open, and the dates after it. */
export default function Overview({ initial }: { initial: OverviewData }) {
  const [data, setData] = useState(initial);
  const task = useAdminTask();
  const today = new Date().toISOString().slice(0, 10);

  const upcoming = data.events
    .filter((event) => event.eventDate.slice(0, 10) >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const next = data.events.find((event) => event.id === data.nextEventId);
  const seated = data.people.filter((person) => holdsSeat(person.status)).length;
  const waiting = data.people.filter((person) => person.status === 'waitlist').length;
  const drafts = upcoming.filter((event) => !event.isPublished).length;

  return (
    <>
      <PageHeader title="Übersicht" description="Was als Nächstes ansteht und was noch offen ist.">
        <button
          type="button"
          disabled={!!task.busy}
          class={button({ variant: 'secondary', size: 'sm' })}
          onClick={() => void task.run('refresh', () => actions.loadAdminOverview(), setData)}
        >
          <Icon name="refresh" class="size-4.5" />
          Aktualisieren
        </button>
      </PageHeader>
      <Feedback notice={task.notice} />
      <div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Kommende Termine"
          icon="calendar"
          value={upcoming.length}
          hint={drafts ? `davon ${drafts} Entwurf${drafts > 1 ? 'e' : ''}` : 'alle veröffentlicht'}
          href="/admin/events"
        />
        <Stat
          label="Plätze belegt"
          icon="users"
          value={next ? `${seated}/${next.maxParticipants}` : '–'}
          hint={next ? `${Math.max(0, next.maxParticipants - seated)} frei am nächsten Abend` : 'kein Termin geplant'}
          href={next && `/admin/events/${next.id}/registrations`}
        />
        <Stat
          label="Warteliste"
          icon="clock"
          value={waiting}
          hint={next ? 'am nächsten Abend' : '–'}
          href={next && `/admin/events/${next.id}/registrations`}
        />
        <Stat
          label="Stimmen zur Prüfung"
          icon="quote"
          value={data.pendingTestimonials}
          tone={data.pendingTestimonials ? 'accent' : undefined}
          hint={data.pendingTestimonials ? 'warten auf Freigabe' : 'nichts offen'}
          href="/admin/testimonials"
        />
      </div>
      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="grid min-w-0 gap-6">
          {next ? (
            <NextEvent event={next} people={data.people} />
          ) : (
            <EmptyState
              action={
                <a href="/admin/events/new" class={button({ size: 'sm' })}>
                  <Icon name="plus" class="size-4.5" />
                  Termin anlegen
                </a>
              }
            >
              Kein Abend geplant.
            </EmptyState>
          )}
          <Upcoming events={upcoming.filter((event) => event.id !== data.nextEventId).slice(0, 5)} />
        </div>
        <Todos items={todos(data, next, upcoming)} />
      </div>
    </>
  );
}

function Upcoming({ events }: { events: AdminEvent[] }) {
  if (!events.length) return null;

  return (
    <section aria-labelledby="upcoming-title" class={card}>
      <div class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="upcoming-title" class="font-sans text-base font-semibold">
          Danach
        </h2>
        <a href="/admin/events" class="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          Alle Termine
          <Icon name="arrowRight" class="size-4" />
        </a>
      </div>
      <ul class="divide-y divide-line">
        {events.map((event) => {
          const date = dateParts(event.eventDate);

          return (
            <li key={event.id}>
              <a
                href={`/admin/events/${event.id}/registrations`}
                class="grid grid-cols-[3rem_minmax(0,1fr)_7rem] items-center gap-4 px-5 py-3 transition-colors duration-180 hover:bg-fg/4"
              >
                <span class="grid justify-items-center leading-none">
                  <span class="text-lg font-semibold tabular-nums">{date.day}</span>
                  <span class="mt-1 text-xs text-fg-muted">{date.month}</span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate font-semibold">{event.title}</span>
                  <span class="mt-0.5 flex items-center gap-2 text-sm text-fg-muted">
                    {!event.isPublished && <StatusPill>Entwurf</StatusPill>}
                    <span class="truncate">{event.city || event.location}</span>
                  </span>
                </span>
                <span class="grid gap-1.5 text-right text-sm tabular-nums">
                  {event.activeCount} / {event.maxParticipants}
                  <Meter
                    value={event.activeCount}
                    max={event.maxParticipants}
                    label={`Plätze belegt: ${event.title}`}
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Todos({ items }: { items: Todo[] }) {
  return (
    <section aria-labelledby="todo-title" class={`${card} lg:sticky lg:top-6`}>
      <h2 id="todo-title" class="border-b border-line px-5 py-4 font-sans text-base font-semibold">
        Zu erledigen
      </h2>
      {items.length ? (
        <ul class="divide-y divide-line">
          {items.map((item) => (
            <li key={item.href + item.text}>
              <a
                href={item.href}
                class="flex items-start gap-3 px-5 py-3.5 text-sm transition-colors duration-180 hover:bg-fg/4"
              >
                <span class="grid size-8 shrink-0 place-items-center rounded-full bg-accent/14 text-accent">
                  <Icon name={item.icon} class="size-4" />
                </span>
                <span class="min-w-0 self-center">{item.text}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p class="flex items-center gap-3 px-5 py-5 text-sm text-fg-muted">
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-success/12 text-success">
            <Icon name="check" class="size-4" />
          </span>
          Alles erledigt.
        </p>
      )}
    </section>
  );
}

function todos(data: OverviewData, next: AdminEvent | undefined, upcoming: AdminEvent[]): Todo[] {
  const items: Todo[] = [];
  const missing = data.people.filter(needsConfirmation).length;

  if (next && !next.isPublished)
    items.push({ href: `/admin/events/${next.id}`, icon: 'eye', text: 'Nächsten Abend veröffentlichen' });

  if (next && missing)
    items.push({
      href: `/admin/events/${next.id}/registrations`,
      icon: 'mail',
      text: missing > 1 ? `${missing} Anmeldebestätigungen fehlen` : 'Eine Anmeldebestätigung fehlt',
    });

  if (data.pendingTestimonials)
    items.push({
      href: '/admin/testimonials',
      icon: 'quote',
      text: `${data.pendingTestimonials} Stimme${data.pendingTestimonials > 1 ? 'n' : ''} prüfen`,
    });

  upcoming
    .filter((event) => !event.isPublished && event.id !== next?.id)
    .forEach((event) =>
      items.push({ href: `/admin/events/${event.id}`, icon: 'edit', text: `Entwurf fertigstellen: ${event.title}` }),
    );

  if (!upcoming.length) items.push({ href: '/admin/events/new', icon: 'plus', text: 'Nächsten Termin anlegen' });

  return items;
}
