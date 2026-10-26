import EventSummary from './EventSummary';
import type { PublicEvent } from './types';
import { usePublicData } from './usePublicData';

export default function LiveSummary({ initial }: { initial: PublicEvent }) {
  const { data = initial, error } = usePublicData<PublicEvent>(
    `/api/public/events/${encodeURIComponent(initial.slug)}`,
    initial,
  );

  return (
    <>
      <EventSummary view={{ ...data.view, kicker: 'Auf einen Blick' }} showTitle={false} showAction={false} />
      {error && (
        <p role="status" class="mt-3 text-sm text-fg-muted">
          Platzstand gerade nicht aktualisierbar. Die Anmeldung prüft die verfügbaren Plätze erneut.
        </p>
      )}
    </>
  );
}
