import type { ComponentChildren } from 'preact';

import type { PublicEvents } from './types';
import { usePublicData } from './usePublicData';

export default function NextEventFact({
  kind,
  children,
}: {
  kind: 'place' | 'time' | 'fee' | 'feeNote';
  children: ComponentChildren;
}) {
  const { data } = usePublicData<PublicEvents>('/api/public/events');

  if (!data?.next) return <>{children}</>;

  const values = {
    place: data.next.place,
    time: data.next.timeRange ? `Nächster Termin: ${data.next.timeRange}` : '',
    fee: data.fee.main,
    feeNote: data.fee.note,
  };

  return <>{values[kind] || children}</>;
}
