# Männerkreis Niederbayern / Straubing

Website for the Männerkreis. Astro 7 (Preact islands in the admin only) on the Bun runtime, Drizzle on `bun:sqlite`,
email via an external listmonk, admin sign-in via Pocket ID. One Bun process serves
everything through `@igloczek/astro-bun-adapter` on Bun's native HTTP server (`server.ts`): static files, SSR pages, actions and the admin UI; one Docker image, deployed with Coolify.

## Development

```bash
bun install
cp .env.example .env   # set OIDC_*, OIDC_ADMIN_GROUP or ADMIN_EMAIL, ADMIN_SESSION_SECRET
bun run dev            # http://localhost:4321 (daemon: bunx astro dev status|logs|stop)
```

```bash
bun run check && bun run lint && bun test   # types, lint, tests
bun run test:pages                          # production HTML, disposable DB; builds first
bun run format                              # prettier
bun run build                               # runs Astro on Bun; Sharp sizes images at build time
bun run db:generate                         # migration after editing db/schema.ts
```

Migrations in `drizzle/` run on boot. The SQLite file defaults to `./data/mens-circle.db`.

## Deployment (Coolify)

1. Dockerfile resource, persistent volume on `/data`, port `8090`.
2. Build variables: `PUBLIC_SITE_URL`; for analytics `PUBLIC_UMAMI_ID` and `PUBLIC_UMAMI_ENDPOINT`.
   The image runs as `bun` (uid 1000): a volume created by an older image must be handed
   over once (`docker run --rm -v <volume>:/data alpine chown -R 1000:1000 /data`).
3. Runtime variables:

| Variable                                                  | Purpose                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `APP_URL`                                                 | public URL for mail links, .ics, OIDC callback               |
| `TRUSTED_PROXY`                                           | `cloudflare` or `none`: source of the rate-limit IP          |
| `RETENTION_DAYS`                                          | anonymise participants N days after the event (≤ 30)         |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`     | Pocket ID client, callback `${APP_URL}/auth/callback`        |
| `OIDC_ADMIN_GROUP`, `ADMIN_EMAIL`                         | who may enter `/admin` (group and/or comma-separated emails) |
| `ADMIN_SESSION_SECRET`                                    | ≥ 32 random characters                                       |
| `LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN` | listmonk API (URL without `/api`)                            |
| `LISTMONK_LIST_IDS`                                       | numeric newsletter list IDs, comma-separated                 |
| `LISTMONK_CAMPAIGN_TEMPLATE_ID`                           | optional campaign template                                   |
| `LISTMONK_TX_*`                                           | six transactional template IDs (below)                       |
| `MAIL_FROM_*`, `MAIL_ADMIN_*`, `MAIL_CONTACT_ADDRESS`     | sender, admin notifications, contact                         |
| `BACKUP_S3_*`, `BACKUP_RETENTION_DAYS`                    | optional SQLite → S3 backup                                  |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT`                | analytics at build time; none unless both are set            |

4. Scheduled task: `bun run scripts/schedule.ts` every minute (reminder pass every 15 min,
   backup daily at 03:00 UTC when configured). Reminders reach participants at a fixed
   Berlin time: from 18:00 the evening before (until 22:00), or, for later
   registrations, from 10:00 on the day until the start. Never at night. At 02:30 UTC
   the retention pass anonymises participants `RETENTION_DAYS` after their last event,
   deletes the event's listmonk list and clears published testimonials' addresses.

## Operations

| When (UTC)   | What                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| every 15 min | reminder pass; mails leave only 18:00–22:00 Berlin the evening before or from 10:00 on the day |
| 02:30 daily  | retention: participants anonymised `RETENTION_DAYS` (≤ 30) after their last event              |
| 03:00 daily  | SQLite → S3 backup when `BACKUP_S3_*` is set; copies older than `BACKUP_RETENTION_DAYS` go     |

The Coolify scheduled task runs `bun run scripts/schedule.ts` every minute in the
container; `bun run scripts/send-reminders.ts` runs one reminder pass by hand.

**Restoring a backup.** Backups are gzipped SQLite snapshots
(`<BACKUP_S3_PREFIX>/mens-circle-<timestamp>.db.gz`, taken with `VACUUM INTO`, so
they are consistent without the WAL files).

1. Download the snapshot you want (S3 console, `aws s3 cp`, `rclone`) and unpack it:
   `gunzip mens-circle-<timestamp>.db.gz`.
2. Check it: `sqlite3 mens-circle-<timestamp>.db 'pragma integrity_check; select count(*) from events;'`.
3. Stop the application in Coolify (the volume stays).
4. Replace the database on the `/data` volume and remove the old WAL files, e.g. with a
   helper container: `docker run --rm -v <volume>:/data -v "$PWD":/in alpine sh -c
'rm -f /data/mens-circle.db-wal /data/mens-circle.db-shm && cp /in/mens-circle-<timestamp>.db /data/mens-circle.db && chown 1000:1000 /data/mens-circle.db'`.
5. Start the application. Migrations newer than the snapshot run on boot; `/health`
   answers 200 once SQLite is readable.

A restore brings back data the retention pass had already anonymised; it is
anonymised again on the next run at 02:30.

## Content

- Page content and section order: directly in `src/pages/*.astro`
- Section markup: `src/components/blocks/`; content arrives as explicit props and slots at its page location
- Static FAQ answers, journey steps and facts use slotted items; FAQ/journey microdata comes from the visible HTML
- Home, `/event` and event pages: server-rendered dates, seats and approved testimonials; no content hydration
- Route cache: Astro's `memoryCache()` (path-keyed, 64 entries), 5 minutes + 5 minutes stale-while-revalidate; every action that changes public data purges it (`purgePublicCache`)
- Event details: SSR metadata, copy and a server-rendered registration form that works without JavaScript
- Admin guard and default `Cache-Control`: `src/middleware.ts`, `src/lib/cache-policy.ts`
- Public CSS: shared hashed stylesheets; the SSR home photo and avatar are pre-sized AVIF/WebP files (no `/_image` at runtime)
- Design: forest, ember and linen; Fraunces 500 (static) and Figtree (variable), ~37 kB of fonts; see [design system](docs/design-system.md)
- Motion and page transitions: the opening in CSS, scroll reveals as CSS scroll-driven animations, a native cross-fade between pages; see the design system's "Motion" and "Page transitions"
- Prefetch through Speculation Rules (no script)
- Server adapter: `@igloczek/astro-bun-adapter` (standalone, bundled), served by `server.ts` on `Bun.serve()`; see [runtime](docs/runtime.md)
- Mail fonts: endpoint `/fonts/mail/[font]`, source files in `src/assets/mail`, with the CORS header required by the external listmonk view
- Live-seat JSON, cache lifetimes and privacy boundary: `docs/public-api.md`
- Legal pages: `src/pages/impressum.astro`, `src/pages/datenschutz.astro` (prerendered)
- Public component behavior: `<script>` in the owning Astro component; shared public form helpers stay in `src/lib/`
- Admin: Preact TSX workspaces with local state, protected Astro Actions and native page navigation; see [admin UI](docs/admin-ui.md)
- Shared layouts: `src/layouts/`; reusable UI, forms and event components: `src/components/`
- Crawler index: `src/pages/llms.txt.ts` (prerendered)
- Site settings, navigation: `src/data/site.json`, `src/data/navigation.json`
- Events, registrations, testimonials: `/admin`
- Event form validation and defaults: `src/lib/event-input.ts`; the action accepts `FormData` directly
- Newsletter: listmonk admin

## Email (listmonk)

The app does not render mail. It calls `POST /api/tx` with a template ID and data;
templates live in listmonk. Newsletter lists need double opt-in. Each transactional
template uses `{{ .Tx.Data.subject }}` as its subject; a missing ID skips that mail.

| Variable                                | Mail                           |
| --------------------------------------- | ------------------------------ |
| `LISTMONK_TX_REGISTRATION_CONFIRMATION` | registration confirmed         |
| `LISTMONK_TX_WAITLIST_CONFIRMATION`     | put on the waitlist            |
| `LISTMONK_TX_ADMIN_NOTIFICATION`        | admin notice per registration  |
| `LISTMONK_TX_WAITLIST_PROMOTION`        | moved up from the waitlist     |
| `LISTMONK_TX_EVENT_REMINDER`            | reminder, event today/tomorrow |
| `LISTMONK_TX_EVENT_MESSAGE`             | message sent from the admin UI |

The payload fields per template are defined in `src/lib/server/email.ts`.
Per-event lists are created automatically and stored in `events.listmonk_list_id`;
keep list and template IDs stable when moving listmonk instances.
