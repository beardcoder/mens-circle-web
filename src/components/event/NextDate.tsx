import EventSummary, { LoadError } from './EventSummary';
import type { PublicEvents } from './types';
import { usePublicData } from './usePublicData';

export default function NextDate() {
  const { data, error, retry } = usePublicData<PublicEvents>('/api/public/events');
  const next = data?.events[0];

  if (!next && !error) return null;

  return (
    <div class="min-w-0 lg:col-span-5 lg:col-start-8">
      {next ? <EventSummary view={next.view} location="home-dates" /> : <LoadError retry={retry} />}
    </div>
  );
}
