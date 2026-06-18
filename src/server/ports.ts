/**
 * Ports — the interfaces the domain depends on, so the host can change without
 * the domain noticing. Default implementations live under `infra/` (SMTP mail,
 * fetch-based listmonk). Swap them for Resend / MailChannels / a stub in tests
 * by wiring a different implementation in the composition root (`container.ts`).
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

/** Sends transactional email. Implementations never throw (log + return false). */
export interface MailPort {
  send(message: MailMessage): Promise<boolean>;
}

export type ListmonkResult = {
  ok: boolean;
  status: 'subscribed' | 'exists' | 'error';
};

/** Newsletter + per-event audience management (listmonk today). */
export interface NewsletterPort {
  /** Forward a newsletter sign-up (listmonk drives the double opt-in). */
  subscribe(email: string, name: string): Promise<ListmonkResult>;
  /** Ensure an event has a list; returns its numeric id (0 if unavailable). */
  ensureEventList(event: {
    id: string;
    title: string;
    eventDate: Date | null;
    listmonkListId: number | null;
  }): Promise<number>;
  /** Add an email to the given list(s), deduped. Best-effort. */
  addToLists(
    email: string,
    name: string,
    listIds: number[],
    confirmed: boolean,
  ): Promise<ListmonkResult>;
  /** Remove an email from a single list. Best-effort. */
  removeFromList(email: string, listId: number): Promise<boolean>;
}
