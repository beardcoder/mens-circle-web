/* eslint-disable no-console */
import { config, listmonkApiConfigured, listmonkConfigured } from './config';

export interface ListmonkSubscriber {
  id: number;
  email: string;
  name: string;
  status: string;
  lists?: Array<{ id: number }>;
}

interface ListmonkResponse {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

const authHeader = (): string => `token ${config.LISTMONK_API_USER}:${config.LISTMONK_API_TOKEN}`;

const request = async (method: string, path: string, body?: unknown): Promise<ListmonkResponse | null> => {
  try {
    const res = await fetch(config.LISTMONK_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      // non-JSON / empty body
    }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (err) {
    console.error('[listmonk] request failed', path, String(err));
    return null;
  }
};

export type SubscribeStatus = 'subscribed' | 'exists' | 'error';

export const subscribeToNewsletter = async (
  email: string,
  name: string,
): Promise<{ ok: boolean; status: SubscribeStatus }> => {
  if (!listmonkConfigured()) {
    console.error('[listmonk] not configured — set LISTMONK_URL / API_USER / API_TOKEN / LIST_IDS');
    return { ok: false, status: 'error' };
  }
  const res = await request('POST', '/api/subscribers', {
    email,
    name: name && name.trim() ? name.trim() : email,
    status: 'enabled',
    lists: config.LISTMONK_LIST_IDS,
    preconfirm_subscriptions: false,
  });
  if (!res) return { ok: false, status: 'error' };
  if (res.ok) return { ok: true, status: 'subscribed' };
  if (res.status === 409) return { ok: true, status: 'exists' };
  console.error('[listmonk] subscribe rejected', email, res.status, JSON.stringify(res.body));
  return { ok: false, status: 'error' };
};

export const findSubscriber = async (email: string): Promise<ListmonkSubscriber | null> => {
  const q = `subscribers.email = '${String(email).replace(/'/g, "''")}'`;
  const res = await request('GET', `/api/subscribers?per_page=1&query=${encodeURIComponent(q)}`);
  if (!res || !res.ok) return null;
  const results = res.body?.data?.results;
  if (Array.isArray(results) && results.length > 0) return results[0] as ListmonkSubscriber;
  return null;
};

export const ensureSubscriber = async (email: string, name: string): Promise<number> => {
  if (!listmonkApiConfigured()) return 0;
  const created = await request('POST', '/api/subscribers', {
    email,
    name: name && name.trim() ? name.trim() : email,
    status: 'enabled',
    preconfirm_subscriptions: true,
  });
  if (created?.ok) return Number(created.body?.data?.id) || 0;
  const sub = await findSubscriber(email);
  return sub?.id ?? 0;
};

export const eventListName = (title: string, dateShort: string): string => {
  const t = (title || 'Veranstaltung').trim();
  return dateShort ? `Event: ${t} (${dateShort})` : `Event: ${t}`;
};

export const createList = async (name: string): Promise<number> => {
  const res = await request('POST', '/api/lists', { name, type: 'private', optin: 'single', tags: ['event'] });
  if (!res || !res.ok) {
    if (res) console.error('[listmonk] create list rejected', name, res.status);
    return 0;
  }
  return Number(res.body?.data?.id) || 0;
};

export const renameList = async (listId: number, name: string): Promise<boolean> => {
  const res = await request('PUT', `/api/lists/${listId}`, { name, type: 'private', optin: 'single' });
  return !!res?.ok;
};

export const addToLists = async (
  email: string,
  name: string,
  listIds: number[],
  confirmed: boolean,
): Promise<{ ok: boolean; status: SubscribeStatus }> => {
  if (!listmonkApiConfigured() || listIds.length === 0) return { ok: false, status: 'error' };
  const cleanName = name && name.trim() ? name.trim() : '';
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
  if (created.status !== 409) {
    console.error('[listmonk] event subscribe rejected', email, created.status, JSON.stringify(created.body));
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
  const nameMissing = subName === '' || subName.toLowerCase() === String(email).toLowerCase();
  if (cleanName && nameMissing) {
    const existingIds = (sub.lists ?? []).flatMap((l) => (l?.id ? [l.id] : []));
    const union = [...new Set([...existingIds, ...listIds])];
    await request('PUT', `/api/subscribers/${sub.id}`, {
      email: sub.email || email,
      name: cleanName,
      status: sub.status || 'enabled',
      lists: union,
      preconfirm_subscriptions: false,
    });
  }

  return { ok: true, status: 'exists' };
};

export const removeFromList = async (email: string, listId: number): Promise<boolean> => {
  if (!listmonkApiConfigured() || !listId) return false;
  const sub = await findSubscriber(email);
  if (!sub?.id) return false;
  const res = await request('PUT', '/api/subscribers/lists', {
    ids: [sub.id],
    action: 'remove',
    target_list_ids: [listId],
  });
  return !!res?.ok;
};

export const sendNewsletterCampaign = async (opts: {
  name: string;
  subject: string;
  bodyHtml: string;
  listIds: number[];
  templateId?: number;
}): Promise<{ ok: boolean; campaignId: number; error?: string }> => {
  if (!listmonkApiConfigured()) {
    return { ok: false, campaignId: 0, error: 'listmonk ist nicht konfiguriert.' };
  }
  if (opts.listIds.length === 0) {
    return { ok: false, campaignId: 0, error: 'Keine Newsletter-Liste konfiguriert (LISTMONK_LIST_IDS).' };
  }

  const created = await request('POST', '/api/campaigns', {
    name: opts.name,
    subject: opts.subject,
    lists: opts.listIds,
    from_email: `${config.MAIL_FROM_NAME} <${config.MAIL_FROM_ADDRESS}>`,
    type: 'regular',
    content_type: 'html',
    body: opts.bodyHtml,
    messenger: 'email',
    ...(opts.templateId ? { template_id: opts.templateId } : {}),
  });
  if (!created?.ok) {
    console.error('[listmonk] campaign create rejected', created?.status, JSON.stringify(created?.body));
    return { ok: false, campaignId: 0, error: 'Kampagne konnte nicht erstellt werden.' };
  }
  const campaignId = Number(created.body?.data?.id) || 0;
  if (!campaignId) return { ok: false, campaignId: 0, error: 'Kampagne wurde ohne ID angelegt.' };

  const started = await request('PUT', `/api/campaigns/${campaignId}/status`, { status: 'running' });
  if (!started?.ok) {
    console.error('[listmonk] campaign start rejected', campaignId, started?.status, JSON.stringify(started?.body));
    return {
      ok: false,
      campaignId,
      error: `Kampagne #${campaignId} wurde als Entwurf angelegt, konnte aber nicht gestartet werden.`,
    };
  }
  return { ok: true, campaignId };
};

export const sendTransactional = async (
  templateId: number,
  to: string,
  recipientName: string,
  data: Record<string, unknown>,
): Promise<boolean> => {
  if (!listmonkApiConfigured()) {
    console.error('[listmonk] cannot send tx mail — listmonk API not configured', { to });
    return false;
  }
  if (!templateId) {
    console.error('[listmonk] missing transactional template id — email skipped', { to });
    return false;
  }

  const subId = await ensureSubscriber(to, recipientName);
  if (!subId) {
    console.error('[listmonk] could not ensure subscriber for tx mail', { to });
    return false;
  }

  const res = await request('POST', '/api/tx', {
    subscriber_id: subId,
    template_id: templateId,
    data,
    content_type: 'html',
    from_email: `${config.MAIL_FROM_NAME} <${config.MAIL_FROM_ADDRESS}>`,
  });
  if (!res?.ok) {
    console.error('[listmonk] tx send failed', { to, templateId, status: res?.status, body: res?.body });
    return false;
  }
  return true;
};
