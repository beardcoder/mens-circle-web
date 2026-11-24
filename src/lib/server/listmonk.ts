/* eslint-disable no-console */
/** The newsletter sign-up: listmonk keeps the list, its double opt-in and the campaigns. */
import { createHash } from 'node:crypto';

import { config, listmonkConfigured } from './config';

interface ListmonkResponse {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

/** An address as logs may show it: a short hash that matches across lines, never the address. */
const logId = (email: string): string =>
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
