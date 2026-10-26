import { button } from '@lib/ui';

import EventSummary, { LoadError, LoadingSummary } from './EventSummary';
import type { PublicEvents } from './types';
import { usePublicData } from './usePublicData';

export default function HeroDate({ secondaryLink, secondaryLabel }: { secondaryLink: string; secondaryLabel: string }) {
  const { data, error, retry } = usePublicData<PublicEvents>('/api/public/events');
  const next = data?.events[0];
  const action = next?.view.action ?? { href: '/event', label: 'Termine ansehen' };

  return (
    <>
      <div class="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:self-end">
        {next ? (
          <EventSummary view={next.view} showAction={false} />
        ) : !data ? (
          error ? (
            <LoadError retry={retry} />
          ) : (
            <LoadingSummary />
          )
        ) : (
          <div class="grid min-h-80 content-center gap-4 border border-line-strong bg-raised p-6 sm:p-8">
            <h2 class="text-sub text-fg">Der nächste Termin folgt</h2>
            <p class="text-md text-fg-soft">
              Alle zwei bis vier Wochen in Straubing. Neue Termine erfährst du per E-Mail.
            </p>
          </div>
        )}
      </div>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 entrance:animate-rise entrance:animate-delay-270 lg:col-span-7 lg:row-start-2">
        <a
          href={action.href}
          class={`${button({ size: 'lg' })} max-sm:w-full sm:min-w-52`}
          data-umami-event="cta-click"
          data-umami-event-location="home-hero"
        >
          {action.label}
        </a>
        <a
          class="group inline-flex min-h-11 items-center gap-2 text-base font-semibold text-accent underline underline-offset-4"
          href={secondaryLink}
        >
          {secondaryLabel}
        </a>
      </div>
    </>
  );
}
