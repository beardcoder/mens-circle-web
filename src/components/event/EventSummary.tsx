import type { SummaryView } from '@lib/event-status';
import { button, card, label } from '@lib/ui';

interface Props {
  view: SummaryView;
  showAction?: boolean;
  showTitle?: boolean;
  location?: string;
}

export default function EventSummary({ view, showAction = true, showTitle = true, location }: Props) {
  return (
    <div data-summary data-state={view.state} class={`${card} grid min-h-80 content-start p-6 sm:p-8`}>
      <p class={label}>{view.kicker}</p>
      {showTitle && (
        <p class="mt-3 font-serif text-sub text-fg">
          {view.datetime ? (
            <time dateTime={view.datetime}>
              {view.title.map((line) => (
                <span class="block truncate" key={line}>
                  {line}
                </span>
              ))}
            </time>
          ) : (
            view.title.map((line) => (
              <span class="block truncate" key={line}>
                {line}
              </span>
            ))
          )}
        </p>
      )}
      <dl
        class={`grid gap-y-3 min-[22.5rem]:grid-cols-[4.5rem_minmax(0,1fr)] min-[22.5rem]:gap-x-3 min-[22.5rem]:gap-y-2 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-x-4 ${showTitle ? 'mt-5 border-t border-line pt-5' : 'mt-4'}`}
      >
        {view.rows.map((row) => (
          <div class="grid min-w-0 min-[22.5rem]:col-span-2 min-[22.5rem]:grid-cols-subgrid" key={row.label}>
            <dt class="truncate text-sm leading-6 text-fg-muted">{row.label}</dt>
            <dd class="truncate text-base leading-6 text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
      {showAction && view.action && (
        <a
          href={view.action.href}
          class={`${button({ variant: view.state === 'full' ? 'secondary' : 'primary', block: true })} mt-6`}
          data-umami-event="cta-click"
          data-umami-event-location={location}
          data-umami-event-state={view.state}
        >
          {view.action.label}
        </a>
      )}
    </div>
  );
}

export function LoadError({ retry }: { retry: () => unknown }) {
  return (
    <div role="status" class="grid justify-items-start gap-3">
      <p class="text-md text-fg-soft">Die Daten sind gerade nicht abrufbar. Bitte versuche es erneut.</p>
      <button type="button" class={button({ variant: 'secondary' })} onClick={() => void retry()}>
        Erneut versuchen
      </button>
    </div>
  );
}
