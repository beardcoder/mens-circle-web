# Männerkreis Niederbayern / Straubing

Website for the Männerkreis. Astro 7 SSR on the Bun runtime, Drizzle on `bun:sqlite`,
email via an external listmonk, admin sign-in via Pocket ID. One Bun process serves
static files, SSR pages, actions and the admin UI; one Docker image, deployed with Coolify.

## Development

```bash
bun install
cp .env.example .env   # set OIDC_*, OIDC_ADMIN_GROUP or ADMIN_EMAIL, ADMIN_SESSION_SECRET
bun run dev            # http://localhost:4321 (daemon: bunx astro dev status|logs|stop)
```

```bash
bun run check && bun run lint && bun test   # types, lint, tests
bun run format                              # prettier
bun run build                               # runs Astro on Bun (Bun.Image needs Bun ≥ 1.4)
bun run db:generate                         # migration after editing db/schema.ts
```

Migrations in `drizzle/` run on boot. The SQLite file defaults to `./data/mens-circle.db`.

## Deployment (Coolify)

1. Dockerfile resource, persistent volume on `/data`, port `8090`.
2. Build variables: `PUBLIC_SITE_URL`, `ASTRO_KEY` (`bunx astro create-key`, keep it stable).
3. Runtime variables:

| Variable                                                  | Purpose                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `APP_URL`                                                 | public URL for mail links, .ics, OIDC callback               |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`     | Pocket ID client, callback `${APP_URL}/auth/callback`        |
| `OIDC_ADMIN_GROUP`, `ADMIN_EMAIL`                         | who may enter `/admin` (group and/or comma-separated emails) |
| `ADMIN_SESSION_SECRET`                                    | ≥ 32 random characters                                       |
| `LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN` | listmonk API (URL without `/api`)                            |
| `LISTMONK_LIST_IDS`                                       | numeric newsletter list IDs, comma-separated                 |
| `LISTMONK_CAMPAIGN_TEMPLATE_ID`                           | optional campaign template                                   |
| `LISTMONK_TX_*`                                           | six transactional template IDs (below)                       |
| `MAIL_FROM_*`, `MAIL_ADMIN_*`, `MAIL_CONTACT_ADDRESS`     | sender, admin notifications, contact                         |
| `BACKUP_S3_*`, `BACKUP_RETENTION_DAYS`                    | optional SQLite → S3 backup                                  |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT`                | optional analytics                                           |

4. Scheduled task: `bun run scripts/schedule.ts` every minute (reminders every 15 min,
   backup daily when configured).

## Content

- Home page copy and block order: `src/content/home.json`
- Site settings, navigation: `src/data/site.json`, `src/data/navigation.json`
- Legal pages: `src/content/legal/*.json`
- Events, registrations, testimonials: `/admin`
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
