import { card } from '@lib/ui';

import EventSummary, { LoadError, LoadingSummary } from './EventSummary';
import type { PublicEvents } from './types';
import { usePublicData } from './usePublicData';

export default function UpcomingEvents() {
  const { data, error, retry } = usePublicData<PublicEvents>('/api/public/events');

  if (!data) return <div class="mt-6">{error ? <LoadError retry={retry} /> : <LoadingSummary />}</div>;

  if (!data.events.length)
    return (
      <div class={`${card} mt-6 grid min-h-80 content-center gap-3 p-6 sm:p-8`}>
        <h3 class="text-sub text-fg">Zurzeit steht kein Termin fest</h3>
        <p class="max-w-measure text-md text-fg-soft">
          Sobald der nächste Abend geplant ist, steht er hier. Trag dich für die Benachrichtigung ein, dann bekommst du
          eine kurze E-Mail.
        </p>
      </div>
    );

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
