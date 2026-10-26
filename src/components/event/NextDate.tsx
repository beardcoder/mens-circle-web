import { button, card } from '@lib/ui';

import EventSummary, { LoadError, LoadingSummary } from './EventSummary';
import type { PublicEvents } from './types';
import { usePublicData } from './usePublicData';

interface Props {
  emptyTitle: string;
  emptyText: string;
  emptyButtonLabel: string;
}

export default function NextDate({ emptyTitle, emptyText, emptyButtonLabel }: Props) {
  const { data, error, retry } = usePublicData<PublicEvents>('/api/public/events');

  if (!data) return error ? <LoadError retry={retry} /> : <LoadingSummary />;

  if (data.events[0]) return <EventSummary view={data.events[0].view} location="home-dates" />;

  return (
    <div class={`${card} grid min-h-80 content-center gap-4 p-6 sm:p-8`}>
      <h3 class="text-sub text-fg">{emptyTitle}</h3>
      <p class="text-md text-fg-soft">{emptyText}</p>
      <a href="#newsletter" class={`${button({ variant: 'secondary' })} justify-self-start max-sm:w-full`}>
        {emptyButtonLabel}
      </a>
    </div>
  );
}
