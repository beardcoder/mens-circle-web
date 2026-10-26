import EventSummary, { LoadError } from './EventSummary';
import type { PublicEvents } from './types';
import { usePublicData } from './usePublicData';

export default function UpcomingEvents() {
  const { data, error, retry } = usePublicData<PublicEvents>('/api/public/events');

  if (!data?.events.length)
    return error ? (
      <div class="mt-6">
        <LoadError retry={retry} />
      </div>
    ) : null;

  return (
    <>
      {error && (
        <p role="status" class="mt-4 text-base text-fg-muted">
          Die Aktualisierung ist gerade nicht möglich. Die zuletzt geladenen Termine bleiben sichtbar.
        </p>
      )}
      <ul role="list" class="mt-6 grid gap-6">
        {data.events.map((event, i) => (
          <li key={event.id} class="motion-safe:animate-fade-in">
            <EventSummary
              view={{ ...event.view, kicker: i === 0 ? 'Nächster Termin' : 'Weiterer Termin' }}
              location="event-landing"
            />
          </li>
        ))}
      </ul>
    </>
  );
}
