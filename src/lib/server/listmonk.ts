/* eslint-disable no-console */
import { AsyncLocalStorage } from 'node:async_hooks';
import { config, listmonkApiConfigured, listmonkConfigured } from './config';

interface ListmonkSubscriber {
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

type SubscribeStatus = 'subscribed' | 'exists' | 'error';

export interface SubscribeResult {
  ok: boolean;
  status: SubscribeStatus;
}

/** Fresh object per call, so callers may keep the result. */
const failed = (): SubscribeResult => ({ ok: false, status: 'error' });

const trimmedName = (name: string): string => (name ?? '').trim();

/** listmonk insists on a name, so an unnamed subscriber is stored under its address. */
const displayName = (name: string, email: string): string => trimmedName(name) || email;

export const subscribeToNewsletter = async (email: string, name: string): Promise<SubscribeResult> => {
  if (!listmonkConfigured()) {
    console.error('[listmonk] not configured — set LISTMONK_URL / API_USER / API_TOKEN / LIST_IDS');
    return failed();
  }
  const res = await request('POST', '/api/subscribers', {
    email,
    name: displayName(name, email),
    status: 'enabled',
    lists: config.LISTMONK_LIST_IDS,
    preconfirm_subscriptions: false,
  });
  if (!res) return failed();
  if (res.ok) return { ok: true, status: 'subscribed' };
  if (res.status === 409) return { ok: true, status: 'exists' };
  console.error('[listmonk] subscribe rejected', email, res.status, JSON.stringify(res.body));
  return failed();
};

const findSubscriber = async (email: string): Promise<ListmonkSubscriber | null> => {
  const q = `subscribers.email = '${String(email).replace(/'/g, "''")}'`;
  const res = await request('GET', `/api/subscribers?per_page=1&query=${encodeURIComponent(q)}`);
  if (!res || !res.ok) return null;
  const results = res.body?.data?.results;
  if (Array.isArray(results) && results.length > 0) return results[0] as ListmonkSubscriber;
  return null;
};

interface SubscriberIdentity {
  subscriber: ListmonkSubscriber;
  created: boolean;
}

type SubscriberWork = Map<string, Promise<SubscriberIdentity | null>>;
const inFlightSubscribers: SubscriberWork = new Map();
const subscriberScope = new AsyncLocalStorage<SubscriberWork>();

/** Reused for one awaited workflow only, never across completed requests. */
export const withSubscriberScope = async <T>(work: () => Promise<T>): Promise<T> => {
  const identities: SubscriberWork = new Map();
  return subscriberScope.run(identities, async () => {
    try {
      return await work();
    } finally {
      identities.clear();
    }
  });
};

const provisionSubscriber = async (email: string, name: string): Promise<SubscriberIdentity | null> => {
  const created = await request('POST', '/api/subscribers', {
    email,
    name: displayName(name, email),
    status: 'enabled',
    preconfirm_subscriptions: true,
  });
  if (created?.ok) {
    const id = Number(created.body?.data?.id) || 0;
    return id
      ? {
          subscriber: { ...created.body.data, id, email, name: displayName(name, email), status: 'enabled' },
          created: true,
        }
      : null;
  }
  // Auth, validation, transport and server errors do not prove the subscriber exists.
  if (created?.status !== 409) return null;
  const sub = await findSubscriber(email);
  return sub?.id ? { subscriber: sub, created: false } : null;
};

const resolveSubscriber = (email: string, name: string): Promise<SubscriberIdentity | null> => {
  const key = email.trim().toLowerCase();
  const scope = subscriberScope.getStore();
  const scoped = scope?.get(key);
  if (scoped) return scoped;
  let pending = inFlightSubscribers.get(key);
  if (!pending) {
    pending = provisionSubscriber(key, name).finally(() => inFlightSubscribers.delete(key));
    inFlightSubscribers.set(key, pending);
  }
  scope?.set(key, pending);
  return pending;
};

export const ensureSubscriber = async (email: string, name: string): Promise<number> => {
  if (!listmonkApiConfigured()) return 0;
  return (await resolveSubscriber(email, name))?.subscriber.id ?? 0;
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

/** Fills a missing name only. The PUT replaces the record, so the lists must be resent. */
const backfillName = async (sub: ListmonkSubscriber, email: string, name: string, listIds: number[]): Promise<void> => {
  const held = (sub.name || '').trim();
  if (!name || (held !== '' && held.toLowerCase() !== String(email).toLowerCase())) return;

  const existingIds = (sub.lists ?? []).flatMap((l) => (l?.id ? [l.id] : []));
  await request('PUT', `/api/subscribers/${sub.id}`, {
    email: sub.email || email,
    name,
    status: sub.status || 'enabled',
    lists: [...new Set([...existingIds, ...listIds])],
    preconfirm_subscriptions: false,
  });
};

/** Add `listIds` to a subscriber that already exists, then fill in its name if it has none. */
const applyMembership = async (
  identity: SubscriberIdentity | null,
  email: string,
  name: string,
  listIds: number[],
  confirmed: boolean,
): Promise<SubscribeResult> => {
  const sub = identity?.subscriber;
  if (!sub?.id) return failed();

  const membership = await request('PUT', '/api/subscribers/lists', {
    ids: [sub.id],
    action: 'add',
    target_list_ids: listIds,
    status: confirmed ? 'confirmed' : 'unconfirmed',
  });
  if (!membership?.ok) {
    console.error('[listmonk] list membership rejected', email, membership?.status);
    return failed();
  }

  await backfillName(sub, email, trimmedName(name), listIds);
  return { ok: true, status: identity?.created ? 'subscribed' : 'exists' };
};

/** Reuses the workflow's subscriber if any; otherwise POST, and only a 409 needs the membership call. */
export const addToLists = async (
  email: string,
  name: string,
  listIds: number[],
  confirmed: boolean,
): Promise<SubscribeResult> => {
  if (!listmonkApiConfigured() || listIds.length === 0) return failed();

  if (subscriberScope.getStore()) {
    return applyMembership(await resolveSubscriber(email, name), email, name, listIds, confirmed);
  }

  const created = await request('POST', '/api/subscribers', {
    email,
    name: displayName(name, email),
    status: 'enabled',
    lists: listIds,
    preconfirm_subscriptions: confirmed,
  });
  if (!created) return failed();
  if (created.ok) return { ok: true, status: 'subscribed' };
  if (created.status !== 409) {
    console.error('[listmonk] event subscribe rejected', email, created.status, JSON.stringify(created.body));
    return failed();
  }

  // 409: the subscriber predates this call, so look it up and add the lists.
  const subscriber = await findSubscriber(email);
  return applyMembership(subscriber ? { subscriber, created: false } : null, email, name, listIds, confirmed);
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

export interface CampaignOptions {
  name: string;
  subject: string;
  bodyHtml: string;
  listIds: number[];
  templateId?: number;
}

export interface CampaignResult {
  ok: boolean;
  campaignId: number;
  /** Shown to the admin verbatim, so every failure carries its own wording. */
  error?: string;
}

/** Create the campaign as a draft. Returns its id, or the message to show the admin. */
const createCampaign = async (opts: CampaignOptions): Promise<{ id: number } | { error: string }> => {
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
    return { error: 'Kampagne konnte nicht erstellt werden.' };
  }
  const id = Number(created.body?.data?.id) || 0;
  return id ? { id } : { error: 'Kampagne wurde ohne ID angelegt.' };
};

const startCampaign = async (campaignId: number): Promise<boolean> => {
  const started = await request('PUT', `/api/campaigns/${campaignId}/status`, { status: 'running' });
  if (started?.ok) return true;
  console.error('[listmonk] campaign start rejected', campaignId, started?.status, JSON.stringify(started?.body));
  return false;
};

/** Create and start a campaign; a created but unstarted one is reported as a draft. */
export const sendNewsletterCampaign = async (opts: CampaignOptions): Promise<CampaignResult> => {
  if (!listmonkApiConfigured()) {
    return { ok: false, campaignId: 0, error: 'listmonk ist nicht konfiguriert.' };
  }
  if (opts.listIds.length === 0) {
    return { ok: false, campaignId: 0, error: 'Keine Newsletter-Liste konfiguriert (LISTMONK_LIST_IDS).' };
  }

  const created = await createCampaign(opts);
  if ('error' in created) return { ok: false, campaignId: 0, error: created.error };

  if (!(await startCampaign(created.id))) {
    return {
      ok: false,
      campaignId: created.id,
      error: `Kampagne #${created.id} wurde als Entwurf angelegt, konnte aber nicht gestartet werden.`,
    };
  }
  return { ok: true, campaignId: created.id };
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
