import type { PublicEvent } from './types';
import { usePublicData } from './usePublicData';

export default function LiveSummary({
  initial,
  venue,
  feeNote,
  hasPlace,
}: {
  initial: PublicEvent;
  venue: string;
  feeNote: string;
  hasPlace: boolean;
}) {
  const { data = initial, error } = usePublicData<PublicEvent>(
    `/api/public/events/${encodeURIComponent(initial.slug)}`,
    initial,
  );

  return (
    <>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-7 border-y border-line py-6 lg:grid-cols-[1fr_1.6fr_1.4fr_1fr] lg:gap-x-8 lg:py-8">
        {data.view.rows.map((row) => (
          <div key={row.label} class="min-w-0">
            <dt class="text-sm text-fg-muted">{row.label === 'Ort' ? 'Treffpunkt' : row.label}</dt>
            <dd class="mt-2 text-base font-medium text-fg sm:text-lg">
              {row.label === 'Ort' ? venue || row.value : row.value}
            </dd>
            {row.label === 'Ort' && hasPlace && (
              <dd class="mt-2 text-sm">
                <a href="#anfahrt" class="inline-flex min-h-8 items-center text-accent underline underline-offset-4">
                  Adresse &amp; Anfahrt
                </a>
              </dd>
            )}
            {row.label === 'Beitrag' && feeNote && <dd class="mt-2 text-sm text-fg-muted">{feeNote}</dd>}
          </div>
        ))}
      </dl>
      {error && (
        <p role="status" class="mt-3 text-sm text-fg-muted">
          Der Platzstand lässt sich gerade nicht aktualisieren. Bei deiner Anmeldung werden die freien Plätze geprüft.
        </p>
      )}
    </>
  );
}
