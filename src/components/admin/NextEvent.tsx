import { button, card } from '@lib/ui';

import type { AdminEvent, RegistrationRow } from './types';
import { Badge, holdsSeat, shortDate } from './ui';

export default function NextEvent({ event, people }: { event: AdminEvent; people: RegistrationRow[] }) {
  const registered = people.filter((person) => holdsSeat(person.status));
  const waiting = people.filter((person) => person.status === 'waitlist');
  const total = Math.min(Math.max(event.maxParticipants, registered.length, 1), 40);

  return (
    <section aria-labelledby="next-event-title" class={`${card} mb-8 grid gap-6 p-5 sm:p-6 lg:grid-cols-[15rem_1fr]`}>
      <figure class="w-full max-w-60 justify-self-center self-center">
        <svg
          viewBox="0 0 320 320"
          role="img"
          aria-label={`${registered.length} von ${event.maxParticipants} Plätzen belegt`}
        >
          <circle cx="160" cy="160" r="120" fill="none" class="stroke-line" />
          <circle cx="160" cy="160" r="43" class="fill-accent/15" />
          <text x="160" y="160" text-anchor="middle" dominant-baseline="central" class="fill-fg text-2xl font-semibold">
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
                <circle cx={x} cy={y} r="18" class={person ? 'fill-accent' : 'fill-raised stroke-line-strong'} />
                <text
                  x={x}
                  y={y}
                  text-anchor="middle"
                  dominant-baseline="central"
                  class={`${person ? 'fill-on-accent' : 'fill-fg-muted'} text-xs font-semibold`}
                >
                  {person ? `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}` : index + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </figure>
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-3">
          <p class="text-sm text-fg-muted">Nächster Abend</p>
          <Badge active={event.isPublished}>{event.isPublished ? 'Öffentlich sichtbar' : 'Noch ein Entwurf'}</Badge>
        </div>
        <h2 id="next-event-title" class="mt-3 font-serif text-2xl">
          {event.title}
        </h2>
        <p class="mt-2 text-sm text-fg-muted">
          {shortDate(event.eventDate)}
          {event.startTime && ` · ${event.startTime} Uhr`}
          {event.location && ` · ${event.location}`}
        </p>
        <div class="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <p>
            <strong class="text-fg">{Math.max(0, event.maxParticipants - registered.length)}</strong> Plätze frei
          </p>
          <p>
            <strong class="text-fg">{waiting.length}</strong> auf der Warteliste
          </p>
        </div>
        {registered.length > 0 && (
          <p class="mt-3 text-sm leading-relaxed text-fg-muted">
            {registered.map((person) => `${person.firstName} ${person.lastName}`).join(', ')}
          </p>
        )}
        <div class="mt-5 flex flex-wrap gap-2">
          <a class={button({ size: 'sm' })} href={`/admin/events/${event.id}/registrations`}>
            Anmeldungen verwalten
          </a>
          <a class={button({ variant: 'secondary', size: 'sm' })} href={`/admin/events/${event.id}`}>
            Termin bearbeiten
          </a>
        </div>
      </div>
    </section>
  );
}
