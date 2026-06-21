/**
 * listmonk integration (server-only) — newsletter subscribers, per-event lists
 * and the transactional email API (`POST /api/tx`).
 *
 * Ported from the former PocketBase `pb_hooks/lib/listmonk.js` and adapted to
 * send transactional mail through listmonk instead of PocketBase's SMTP mailer.
 * Every call is best-effort: failures are logged and never throw, so a
 * registration / admin action never 500s because listmonk is briefly down.
 */
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

function authHeader(): string {
  // listmonk v2+ supports API tokens via the "token user:token" scheme.
  return `token ${config.LISTMONK_API_USER}:${config.LISTMONK_API_TOKEN}`;
}

/** Low-level call to the listmonk admin API. Never throws. */
async function request(method: string, path: string, body?: unknown): Promise<ListmonkResponse | null> {
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
    // eslint-disable-next-line no-console
    console.error('[listmonk] request failed', path, String(err));
    return null;
  }
}

// ── Newsletter ───────────────────────────────────────────────────────────────

export type SubscribeStatus = 'subscribed' | 'exists' | 'error';

/** Subscribe an email to the configured newsletter list(s) (double opt-in). */
export async function subscribeToNewsletter(
  email: string,
  name: string,
): Promise<{ ok: boolean; status: SubscribeStatus }> {
  if (!listmonkConfigured()) {
    // eslint-disable-next-line no-console
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
  // eslint-disable-next-line no-console
  console.error('[listmonk] subscribe rejected', email, res.status, JSON.stringify(res.body));
  return { ok: false, status: 'error' };
}

// ── Subscribers ────────────────────────────────────────────────────────────

/** Look up a subscriber by exact email, or null. */
export async function findSubscriber(email: string): Promise<ListmonkSubscriber | null> {
  const q = `subscribers.email = '${String(email).replace(/'/g, "''")}'`;
  const res = await request('GET', `/api/subscribers?per_page=1&query=${encodeURIComponent(q)}`);
  if (!res || !res.ok) return null;
  const results = res.body?.data?.results;
  if (Array.isArray(results) && results.length > 0) return results[0] as ListmonkSubscriber;
  return null;
}

/**
 * Ensure a subscriber exists for `email` (listmonk's /api/tx requires the
 * recipient to be a subscriber). Returns the subscriber id, or 0 on failure.
 */
export async function ensureSubscriber(email: string, name: string): Promise<number> {
  if (!listmonkApiConfigured()) return 0;
  const created = await request('POST', '/api/subscribers', {
    email,
    name: name && name.trim() ? name.trim() : email,
    status: 'enabled',
    preconfirm_subscriptions: true,
  });
  if (created?.ok) {
    return Number(created.body?.data?.id) || 0;
  }
  // 409 → already exists; fetch the id.
  const sub = await findSubscriber(email);
  return sub?.id ?? 0;
}

// ── Per-event lists ──────────────────────────────────────────────────────────

/** Human-readable listmonk list name for an event. */
export function eventListName(title: string, dateShort: string): string {
  const t = (title || 'Veranstaltung').trim();
  return dateShort ? `Event: ${t} (${dateShort})` : `Event: ${t}`;
}

/** Create a private, single-opt-in list. Returns its numeric id, or 0. */
export async function createList(name: string): Promise<number> {
  const res = await request('POST', '/api/lists', { name, type: 'private', optin: 'single', tags: ['event'] });
  if (!res || !res.ok) {
    if (res) console.error('[listmonk] create list rejected', name, res.status); // eslint-disable-line no-console
    return 0;
  }
  return Number(res.body?.data?.id) || 0;
}

/** Best-effort rename of an existing list. */
export async function renameList(listId: number, name: string): Promise<boolean> {
  const res = await request('PUT', `/api/lists/${listId}`, { name, type: 'private', optin: 'single' });
  return !!res?.ok;
}

/**
 * Add an email to the given list(s), deduped by email. Sets the subscriber's
 * name when it was still missing (e.g. a no-name newsletter sign-up). Returns
 * a coarse status. Best-effort.
 */
export async function addToLists(
  email: string,
  name: string,
  listIds: number[],
  confirmed: boolean,
): Promise<{ ok: boolean; status: SubscribeStatus }> {
  if (!listmonkApiConfigured() || listIds.length === 0) return { ok: false, status: 'error' };
  const cleanName = name && name.trim() ? name.trim() : '';
  const status = confirmed ? 'confirmed' : 'unconfirmed';

  // 1) Try to create the subscriber with the target lists in one shot.
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
    // eslint-disable-next-line no-console
    console.error('[listmonk] event subscribe rejected', email, created.status, JSON.stringify(created.body));
    return { ok: false, status: 'error' };
  }

  // 2) Already a subscriber — fetch it for its id + current lists/name.
  const sub = await findSubscriber(email);
  if (!sub?.id) return { ok: false, status: 'error' };

  // 3) Add the event list(s) additively (never touches other lists).
  await request('PUT', '/api/subscribers/lists', {
    ids: [sub.id],
    action: 'add',
    target_list_ids: listIds,
    status,
  });

  // 4) Backfill the name only when it's missing.
  const subName = (sub.name || '').trim();
  const nameMissing = subName === '' || subName.toLowerCase() === String(email).toLowerCase();
  if (cleanName && nameMissing) {
    const union: number[] = [];
    for (const l of sub.lists ?? []) if (l?.id && !union.includes(l.id)) union.push(l.id);
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
}

/** Remove an email from a single list (used on cancellation). Best-effort. */
export async function removeFromList(email: string, listId: number): Promise<boolean> {
  if (!listmonkApiConfigured() || !listId) return false;
  const sub = await findSubscriber(email);
  if (!sub?.id) return false;
  const res = await request('PUT', '/api/subscribers/lists', {
    ids: [sub.id],
    action: 'remove',
    target_list_ids: [listId],
  });
  return !!res?.ok;
}

// ── Newsletter campaigns ─────────────────────────────────────────────────────

/**
 * Create a regular email campaign and start it immediately. Used to broadcast
 * an event announcement to the public newsletter list(s) — the same list
 * people subscribe to via the sign-up form. Best-effort: returns a coarse
 * result with an error message instead of throwing.
 */
export async function sendNewsletterCampaign(opts: {
  name: string;
  subject: string;
  bodyHtml: string;
  listIds: number[];
  /** listmonk campaign template ID (the branded wrapper). 0 → default template. */
  templateId?: number;
}): Promise<{ ok: boolean; campaignId: number; error?: string }> {
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
    // Wrap the prose body in the branded campaign template (signature, footer,
    // unsubscribe). When 0, listmonk falls back to its default template.
    ...(opts.templateId && opts.templateId > 0 ? { template_id: opts.templateId } : {}),
  });
  if (!created?.ok) {
    // eslint-disable-next-line no-console
    console.error('[listmonk] campaign create rejected', created?.status, JSON.stringify(created?.body));
    return { ok: false, campaignId: 0, error: 'Kampagne konnte nicht erstellt werden.' };
  }
  const campaignId = Number(created.body?.data?.id) || 0;
  if (!campaignId) return { ok: false, campaignId: 0, error: 'Kampagne wurde ohne ID angelegt.' };

  const started = await request('PUT', `/api/campaigns/${campaignId}/status`, { status: 'running' });
  if (!started?.ok) {
    // eslint-disable-next-line no-console
    console.error('[listmonk] campaign start rejected', campaignId, started?.status, JSON.stringify(started?.body));
    return {
      ok: false,
      campaignId,
      error: `Kampagne #${campaignId} wurde als Entwurf angelegt, konnte aber nicht gestartet werden.`,
    };
  }
  return { ok: true, campaignId };
}

// ── Transactional email ──────────────────────────────────────────────────────

/**
 * Send a transactional message through listmonk (`POST /api/tx`). The template
 * (markup + subject) is maintained in listmonk and referenced by `templateId`;
 * `data` is the variable payload it renders (`{{ .Tx.Data.* }}`).
 *
 * Ensures the recipient exists as a subscriber first (a listmonk requirement).
 * Best-effort: returns false (and logs) on any failure.
 */
export async function sendTransactional(
  templateId: number,
  to: string,
  recipientName: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!listmonkApiConfigured()) {
    // eslint-disable-next-line no-console
    console.error('[listmonk] cannot send tx mail — listmonk API not configured', { to });
    return false;
  }
  if (!templateId) {
    // eslint-disable-next-line no-console
    console.error('[listmonk] missing transactional template id — email skipped', { to });
    return false;
  }

  const subId = await ensureSubscriber(to, recipientName);
  if (!subId) {
    // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.error('[listmonk] tx send failed', { to, templateId, status: res?.status, body: res?.body });
    return false;
  }
  return true;
}
