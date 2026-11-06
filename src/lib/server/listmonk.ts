/* eslint-disable no-console */
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

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

/** An address as logs may show it: a short hash that matches across lines, never the address. */
export const logId = (email: string): string =>
  `subscriber#${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 10)}`;

/** A request path without its query (the subscriber lookup carries the address there). */
const logPath = (path: string): string => path.split('?')[0];

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
    console.error('[listmonk] request failed', logPath(path), String(err));

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

/** listmonk insists on a name, so an unnamed subscriber is stored under its address. */
const displayName = (name: string, email: string): string => (name ?? '').trim() || email;

const fromEmail = (): string => `${config.MAIL_FROM_NAME} <${config.MAIL_FROM_ADDRESS}>`;

/** Create an enabled subscriber; listmonk answers 409 when the address exists. */
const postSubscriber = (
  email: string,
  name: string,
  extra: { lists?: number[]; preconfirm_subscriptions: boolean },
): Promise<ListmonkResponse | null> =>
  request('POST', '/api/subscribers', { email, name: displayName(name, email), status: 'enabled', ...extra });

export const subscribeToNewsletter = async (email: string, name: string): Promise<SubscribeResult> => {
  if (!listmonkConfigured()) {
    console.error('[listmonk] not configured — set LISTMONK_URL / API_USER / API_TOKEN / LIST_IDS');

    return failed();
  }

  const res = await postSubscriber(email, name, { lists: config.LISTMONK_LIST_IDS, preconfirm_subscriptions: false });

  if (!res) return failed();

  if (res.ok) return { ok: true, status: 'subscribed' };

  if (res.status === 409) return { ok: true, status: 'exists' };

  console.error('[listmonk] subscribe rejected', logId(email), res.status);

  return failed();
};

/** Looks a subscriber up by address; `ok` is false when listmonk could not answer. */
const lookupSubscriber = async (email: string): Promise<{ ok: boolean; subscriber: ListmonkSubscriber | null }> => {
  const q = `subscribers.email = '${String(email).replace(/'/g, "''")}'`;
  const res = await request('GET', `/api/subscribers?per_page=1&query=${encodeURIComponent(q)}`);

  if (!res || !res.ok) return { ok: false, subscriber: null };

  const results = res.body?.data?.results;

  return { ok: true, subscriber: Array.isArray(results) && results.length > 0 ? results[0] : null };
};

const findSubscriber = async (email: string): Promise<ListmonkSubscriber | null> =>
  (await lookupSubscriber(email)).subscriber;

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
  const created = await postSubscriber(email, name, { preconfirm_subscriptions: true });

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
    console.error('[listmonk] list membership rejected', logId(email), membership?.status);

    return failed();
  }

  await backfillName(sub, email, (name ?? '').trim(), listIds);

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

  const created = await postSubscriber(email, name, { lists: listIds, preconfirm_subscriptions: confirmed });

  if (!created) return failed();

  if (created.ok) return { ok: true, status: 'subscribed' };

  if (created.status !== 409) {
    console.error('[listmonk] event subscribe rejected', logId(email), created.status);

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

/** Deletes a list (an event's, once its data has expired). A missing list counts as deleted. */
export const deleteList = async (listId: number): Promise<boolean> => {
  if (!listmonkApiConfigured() || listId <= 0) return false;

  const res = await request('DELETE', `/api/lists/${listId}`);

  return !!res && (res.ok || res.status === 404);
};

/**
 * Removes a participant from listmonk once their registrations have expired, unless
 * they also subscribed to the newsletter (that consent stands on its own). Resolves
 * to whether nothing of theirs is left that should not be: true when deleted, kept
 * for the newsletter, never there, or listmonk is not in use.
 */
export const forgetSubscriber = async (email: string): Promise<boolean> => {
  if (!listmonkApiConfigured()) return true;

  const { ok, subscriber: sub } = await lookupSubscriber(email);

  if (!ok) return false;

  if (!sub?.id) return true;

  const lists = (sub.lists ?? []).map((list) => list.id);

  if (lists.some((id) => config.LISTMONK_LIST_IDS.includes(id))) return true;

  const res = await request('DELETE', `/api/subscribers/${sub.id}`);

  return !!res && (res.ok || res.status === 404);
};

interface CampaignOptions {
  name: string;
  subject: string;
  bodyHtml: string;
  listIds: number[];
  templateId?: number;
}

interface CampaignResult {
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
    from_email: fromEmail(),
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
    console.error('[listmonk] cannot send tx mail — listmonk API not configured', logId(to));

    return false;
  }

  if (!templateId) {
    console.error('[listmonk] missing transactional template id — email skipped', logId(to));

    return false;
  }

  const subId = await ensureSubscriber(to, recipientName);

  if (!subId) {
    console.error('[listmonk] could not ensure subscriber for tx mail', logId(to));

    return false;
  }

  const res = await request('POST', '/api/tx', {
    subscriber_id: subId,
    template_id: templateId,
    data,
    content_type: 'html',
    from_email: fromEmail(),
  });

  if (!res?.ok) {
    console.error('[listmonk] tx send failed', logId(to), { templateId, status: res?.status });

    return false;
  }

  return true;
};
