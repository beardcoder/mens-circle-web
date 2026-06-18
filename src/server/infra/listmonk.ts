/**
 * listmonk client — newsletter sign-ups + per-event audience lists. Ported from
 * the former `pb_hooks/lib/listmonk.js` to plain `fetch`. Subscribers, double
 * opt-in, campaigns and unsubscribe all live in listmonk; this only forwards.
 *
 * Implements {@link NewsletterPort}. Every call is best-effort and never throws.
 */
import { config } from '../config';
import { formatDateShortDE } from '../format';
import type { ListmonkResult, NewsletterPort } from '../ports';

type ListmonkSubscriber = {
  id: number;
  email: string;
  name: string;
  status: string;
  lists?: Array<{ id: number }>;
};

function apiConfigured(): boolean {
  return (
    config.LISTMONK_URL.length > 0 &&
    config.LISTMONK_API_USER.length > 0 &&
    config.LISTMONK_API_TOKEN.length > 0
  );
}

function newsletterConfigured(): boolean {
  return apiConfigured() && config.LISTMONK_LIST_IDS.length > 0;
}

type Res = { ok: boolean; statusCode: number; json: unknown };

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<Res | null> {
  try {
    const res = await fetch(config.LISTMONK_URL + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `token ${config.LISTMONK_API_USER}:${config.LISTMONK_API_TOKEN}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // non-JSON body
    }
    return { ok: res.ok, statusCode: res.status, json };
  } catch (err) {
    console.error('[listmonk] request failed', path, String(err));
    return null;
  }
}

function eventListName(event: {
  title: string;
  eventDate: Date | null;
}): string {
  const title = (event.title || 'Veranstaltung').trim();
  const date = formatDateShortDE(event.eventDate);
  return date ? `Event: ${title} (${date})` : `Event: ${title}`;
}

async function findSubscriber(
  email: string,
): Promise<ListmonkSubscriber | null> {
  const q = `subscribers.email = '${String(email).replace(/'/g, "''")}'`;
  const res = await request(
    'GET',
    `/api/subscribers?per_page=1&query=${encodeURIComponent(q)}`,
  );
  if (!res?.ok) return null;
  try {
    const results = (res.json as { data?: { results?: ListmonkSubscriber[] } })
      ?.data?.results;
    if (results && results.length > 0) return results[0];
  } catch {
    // ignore
  }
  return null;
}

export const listmonk: NewsletterPort = {
  async subscribe(email, name): Promise<ListmonkResult> {
    if (!newsletterConfigured()) {
      console.error(
        '[listmonk] not configured — set LISTMONK_URL / LISTMONK_API_USER / LISTMONK_API_TOKEN / LISTMONK_LIST_IDS',
      );
      return { ok: false, status: 'error' };
    }
    const res = await request('POST', '/api/subscribers', {
      email,
      name: name?.trim() ? name.trim() : email,
      status: 'enabled',
      lists: config.LISTMONK_LIST_IDS,
      preconfirm_subscriptions: false,
    });
    if (!res) return { ok: false, status: 'error' };
    if (res.ok) return { ok: true, status: 'subscribed' };
    if (res.statusCode === 409) return { ok: true, status: 'exists' };
    console.error('[listmonk] subscribe rejected', email, res.statusCode);
    return { ok: false, status: 'error' };
  },

  async ensureEventList(event): Promise<number> {
    if (!apiConfigured()) return 0;
    if (event.listmonkListId && event.listmonkListId > 0)
      return event.listmonkListId;

    const res = await request('POST', '/api/lists', {
      name: eventListName(event),
      type: 'private',
      optin: 'single',
      tags: ['event'],
    });
    if (!res?.ok) {
      if (res) console.error('[listmonk] create list rejected', res.statusCode);
      return 0;
    }
    try {
      const id = (res.json as { data?: { id?: number } })?.data?.id ?? 0;
      return id > 0 ? id : 0;
    } catch {
      return 0;
    }
  },

  async addToLists(email, name, listIds, confirmed): Promise<ListmonkResult> {
    if (!apiConfigured() || !listIds || listIds.length === 0) {
      return { ok: false, status: 'error' };
    }
    const cleanName = name?.trim() ? name.trim() : '';
    const status = confirmed ? 'confirmed' : 'unconfirmed';

    const created = await request('POST', '/api/subscribers', {
      email,
      name: cleanName || email,
      status: 'enabled',
      lists: listIds,
      preconfirm_subscriptions: confirmed,
    });
    if (!created) return { ok: false, status: 'error' };
    if (created.ok) return { ok: true, status: 'subscribed' };
    if (created.statusCode !== 409) {
      console.error(
        '[listmonk] event subscribe rejected',
        email,
        created.statusCode,
      );
      return { ok: false, status: 'error' };
    }

    const sub = await findSubscriber(email);
    if (!sub?.id) return { ok: false, status: 'error' };

    await request('PUT', '/api/subscribers/lists', {
      ids: [sub.id],
      action: 'add',
      target_list_ids: listIds,
      status,
    });

    const subName = (sub.name || '').trim();
    const nameMissing =
      subName === '' || subName.toLowerCase() === String(email).toLowerCase();
    if (cleanName && nameMissing) {
      const union: number[] = [];
      for (const l of sub.lists || []) {
        if (l?.id && !union.includes(l.id)) union.push(l.id);
      }
      for (const lid of listIds) if (!union.includes(lid)) union.push(lid);
      await request('PUT', `/api/subscribers/${sub.id}`, {
        email: sub.email || email,
        name: cleanName,
        status: sub.status || 'enabled',
        lists: union,
        preconfirm_subscriptions: false,
      });
    }
    return { ok: true, status: 'exists' };
  },

  async removeFromList(email, listId): Promise<boolean> {
    if (!apiConfigured() || !listId) return false;
    const sub = await findSubscriber(email);
    if (!sub?.id) return false;
    const res = await request('PUT', '/api/subscribers/lists', {
      ids: [sub.id],
      action: 'remove',
      target_list_ids: [listId],
    });
    return !!res?.ok;
  },
};
