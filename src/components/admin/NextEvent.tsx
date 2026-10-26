import { button, card } from '@lib/ui';

import { Icon } from './icons';
import type { AdminEvent, RegistrationRow } from './types';
import { holdsSeat, shortDate, StatusPill } from './ui';

export default function NextEvent({ event, people }: { event: AdminEvent; people: RegistrationRow[] }) {
  const registered = people.filter((person) => holdsSeat(person.status));
  const waiting = people.filter((person) => person.status === 'waitlist').length;
  const free = Math.max(0, event.maxParticipants - registered.length);

  return (
    <section
      aria-labelledby="next-event-title"
      class={`${card} grid gap-6 p-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:p-6`}
    >
      <SeatCircle event={event} registered={registered} />
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-3">
          <p class="text-sm text-fg-muted">Nächster Abend</p>
          <StatusPill tone={event.isPublished ? 'success' : 'accent'}>
            {event.isPublished ? 'Öffentlich sichtbar' : 'Noch ein Entwurf'}
          </StatusPill>
        </div>
        <h2 id="next-event-title" class="mt-2 text-sub">
          {event.title}
        </h2>
        <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-fg-muted">
          <li class="flex items-center gap-1.5">
            <Icon name="calendar" class="size-4" />
            {shortDate(event.eventDate)}
          </li>
          {event.startTime && (
            <li class="flex items-center gap-1.5">
              <Icon name="clock" class="size-4" />
              {event.startTime}
              {event.endTime && `–${event.endTime}`} Uhr
            </li>
          )}
          {(event.location || event.city) && (
            <li class="flex min-w-0 items-center gap-1.5">
              <Icon name="pin" class="size-4" />
              <span class="truncate">{event.location || event.city}</span>
            </li>
          )}
        </ul>
        <dl class="mt-5 grid grid-cols-3 gap-3 border-y border-line py-4">
          <Figure label="Angemeldet" value={registered.length} />
          <Figure label="Frei" value={free} />
          <Figure label="Warteliste" value={waiting} />
        </dl>
        <div class="mt-5 flex flex-wrap gap-2">
          <a class={button({ size: 'sm' })} href={`/admin/events/${event.id}/registrations`}>
            <Icon name="users" class="size-4.5" />
            Anmeldungen verwalten
          </a>
          <a class={button({ variant: 'secondary', size: 'sm' })} href={`/admin/events/${event.id}`}>
            <Icon name="edit" class="size-4.5" />
            Bearbeiten
          </a>
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt class="text-xs text-fg-muted">{label}</dt>
      <dd class="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** The circle itself: one seat per place, filled with the initials of whoever holds it. */
function SeatCircle({ event, registered }: { event: AdminEvent; registered: RegistrationRow[] }) {
  const total = Math.min(Math.max(event.maxParticipants, registered.length, 1), 40);
  const seat = total > 16 ? 15 : 26;

  return (
    <figure class="w-full max-w-52 self-center justify-self-center">
      <svg
        viewBox="0 0 320 320"
        role="img"
        aria-label={`${registered.length} von ${event.maxParticipants} Plätzen belegt`}
      >
        <circle cx="160" cy="160" r="120" fill="none" class="stroke-line-strong" />
        <text
          x="160"
          y="160"
          text-anchor="middle"
          dominant-baseline="central"
          class="fill-fg font-serif text-[3.5rem] tabular-nums"
        >
          {registered.length}/{event.maxParticipants}
        </text>
        {Array.from({ length: total }, (_, index) => {
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
          const x = 160 + 120 * Math.cos(angle);
          const y = 160 + 120 * Math.sin(angle);
          const person = registered[index];

          return (
            <g key={index}>
              <title>{person ? `${person.firstName} ${person.lastName}` : 'Freier Platz'}</title>
              <circle cx={x} cy={y} r={seat} class={person ? 'fill-fill' : 'fill-raised stroke-line-bold'} />
              <text
                x={x}
                y={y}
                text-anchor="middle"
                dominant-baseline="central"
                class={`${person ? 'fill-on-fill' : 'fill-fg-muted'} text-[1.25rem] font-semibold`}
              >
                {person ? `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}` : index + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
