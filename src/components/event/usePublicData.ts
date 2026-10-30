import { useEffect, useState } from 'preact/hooks';

/**
 * Live public data for an island. It starts from the snapshot the page was rendered
 * with (the server purges that snapshot on every change), so the first read is free;
 * it reads again only when the page comes back into view after `maxAge`. No polling.
 */
export function usePublicData<T>(url: string, initial: T, maxAge = 30_000) {
  const [state, setState] = useState({ data: initial, error: false });

  useEffect(() => {
    let updated = Date.now();
    let pending = false;

    const refresh = async () => {
      if (document.hidden || pending || Date.now() - updated < maxAge) return;

      pending = true;

      try {
        const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });

        if (!response.ok) throw new Error('Public data unavailable');

        const data = (await response.json()) as T;

        updated = Date.now();
        setState({ data, error: false });
      } catch {
        setState((current) => ({ ...current, error: true }));
      } finally {
        pending = false;
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [url]);

  return state;
}
