import { useEffect, useState } from 'preact/hooks';

interface Resource {
  data?: unknown;
  error: boolean;
  updated: number;
  maxAge: number;
  pending?: Promise<void>;
  refreshAfterPending?: boolean;
  listeners: Set<() => void>;
}

const resources = new Map<string, Resource>();

export async function refreshPublicData(url: string, force = false): Promise<void> {
  const entry = resources.get(url);

  if (!entry) return;

  if (entry.pending) {
    if (force) entry.refreshAfterPending = true;

    return entry.pending;
  }

  if (!force && Date.now() - entry.updated < entry.maxAge) return;

  // Default credentials and cache mode, so the first read can take the layout's
  // `<link rel="preload" as="fetch" crossorigin>`; the responses say must-revalidate.
  entry.pending = fetch(force ? `${url}?refresh=${Date.now()}` : url, {
    signal: AbortSignal.timeout(8000),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Public data unavailable');

      entry.data = await response.json();
      entry.error = false;
      entry.updated = Date.now();
    })
    .catch(() => {
      entry.error = true;
    })
    .finally(() => {
      entry.pending = undefined;
      entry.listeners.forEach((notify) => notify());

      if (entry.refreshAfterPending) {
        entry.refreshAfterPending = false;
        void refreshPublicData(url, true);
      }
    });

  return entry.pending;
}

/** One request per URL across islands; no polling, no global client entry. */
export function usePublicData<T>(url: string, initial?: T, maxAge = 30_000) {
  const [state, setState] = useState<{ data?: T; error: boolean }>({ data: initial, error: false });

  useEffect(() => {
    let entry = resources.get(url);

    if (!entry) {
      entry = { data: initial, error: false, updated: 0, maxAge, listeners: new Set() };
      resources.set(url, entry);
    }

    const update = () => setState({ data: entry.data as T | undefined, error: entry.error });

    const focus = () => {
      if (!document.hidden) void refreshPublicData(url);
    };

    entry.listeners.add(update);
    update();
    void refreshPublicData(url);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);

    return () => {
      entry.listeners.delete(update);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [url]);

  return { ...state, retry: () => refreshPublicData(url, true) };
}
