/**
 * Days after an event until its participants' data is anonymised (server/retention.ts).
 * The privacy policy prints this number; `RETENTION_DAYS` may only lower it in
 * production, since the policy is prerendered at build time.
 */
export const DEFAULT_RETENTION_DAYS = 30;
