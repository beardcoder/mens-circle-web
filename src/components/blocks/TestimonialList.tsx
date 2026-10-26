import { useState } from 'preact/hooks';

import type { TestimonialDTO } from '@lib/types';

import { LoadError } from '../event/EventSummary';
import { usePublicData } from '../event/usePublicData';

function Quote({ item, featured = false }: { item: TestimonialDTO; featured?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = !featured && item.quote.length > 360;

  return (
    <figure class="grid content-start">
      <blockquote
        class={`${featured ? 'font-serif text-quote text-fg' : 'max-w-measure text-md text-fg-soft'} ${collapsible && !expanded ? 'line-clamp-6' : ''}`}
      >
        „{item.quote}“
      </blockquote>
      {(item.author || item.role) && (
        <figcaption class="mt-4 text-sm text-fg-muted">
          <cite class="font-semibold text-fg not-italic">{[item.author, item.role].filter(Boolean).join(' · ')}</cite>
        </figcaption>
      )}
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          class="mt-1 inline-flex min-h-11 w-fit items-center text-base font-semibold text-accent underline decoration-1 underline-offset-4 transition-colors duration-180 hover:text-accent-strong"
        >
          {expanded ? 'Weniger anzeigen' : 'Vollständige Erfahrung lesen'}
        </button>
      )}
    </figure>
  );
}

export default function TestimonialList({ emptyText, errorText }: { emptyText: string; errorText: string }) {
  const { data, error, retry } = usePublicData<{ testimonials: TestimonialDTO[] }>(
    '/api/public/testimonials',
    undefined,
    300_000,
  );

  if (!data)
    return error ? (
      <div class="mt-6">
        <p class="mb-4 text-md text-fg-muted">{errorText}</p>
        <LoadError retry={retry} />
      </div>
    ) : (
      <p role="status" class="mt-6 min-h-24 text-md text-fg-muted">
        Erfahrungen werden geladen …
      </p>
    );

  if (!data.testimonials.length) return <p class="mt-6 text-md text-fg-muted">{emptyText}</p>;

  const [first, ...others] = data.testimonials;
  const featured = first.quote.length <= 160;
  const rest = featured ? others : data.testimonials;

  return (
    <div class="motion-safe:animate-fade-in">
      {featured && (
        <div class="mt-group max-w-176">
          <Quote item={first} featured />
        </div>
      )}
      <ul role="list" class="mt-group gap-x-grid md:columns-2">
        {rest.map((item, i) => (
          <li key={`${item.author}-${i}`} class="mb-8 break-inside-avoid border-t border-line pt-6">
            <Quote item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
