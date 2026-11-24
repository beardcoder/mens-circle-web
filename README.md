# Männerkreis Niederbayern / Straubing

Website for the Männerkreis. Astro 7 on the Bun runtime with [EmDash](https://github.com/emdash-cms/emdash)
as the CMS: events, registrations and voices are EmDash collections on SQLite, the admin is
EmDash's (`/_emdash/admin`, passkeys), and one native plugin (`src/plugin`) handles public
sign-ups, the seat limit, the participant mails, cancel links, reminders and deletion.
The newsletter list lives in an external listmonk. One Bun process serves everything through
`@igloczek/astro-bun-adapter` on Bun's native HTTP server (`server.ts`); one Docker image,
deployed with Coolify.

## Development

```bash
bun install
cp .env.example .env   # CANCEL_LINK_SECRET; SMTP and listmonk if you want mails
bun run dev            # http://localhost:4321, admin at /_emdash/admin
```

```bash
bun run check && bun run lint && bun test   # types, lint, tests
bun run test:pages                          # production HTML on a disposable EmDash site; builds first
bun run test:browser                        # Chromium, axe and forms; builds first
bun run format                              # prettier
bun run build                               # runs Astro on Bun; Sharp sizes images at build time
```

The collections come from `seed/seed.json`, applied on first start. The database is
`./data/emdash.db` (`DATABASE_PATH`, baked into the build); the admin sessions live beside
it in `sessions/`. In `astro dev` mails go to the terminal (EmDash's console provider).

## Deployment (Coolify)

1. Dockerfile resource, persistent volume on `/data`, port `8090`.
2. Build variables: `PUBLIC_SITE_URL`; for analytics `PUBLIC_UMAMI_ID` and `PUBLIC_UMAMI_ENDPOINT`.
   The server runs as `bun` (uid 1000); the entrypoint hands a root-owned `/data`
   volume (from an older image) to it on start.
3. Runtime variables:

| Variable                                                  | Purpose                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `APP_URL`                                                 | public URL for mail links and .ics                             |
| `TRUSTED_PROXY`                                           | `cloudflare` or `none`: source of the form rate-limit IP       |
| `EMDASH_TRUSTED_PROXY_HEADERS`                            | e.g. `cf-connecting-ip`, for EmDash's sign-in rate limits      |
| `RETENTION_DAYS`                                          | delete registrations N days after the event (≤ 30)             |
| `CANCEL_LINK_SECRET`                                      | ≥ 32 random characters; signs the cancel links                 |
| `EMDASH_ENCRYPTION_KEY`                                   | `bunx emdash secrets generate`; for secrets saved in the admin |
| `EMAIL_SMTP_*`                                            | SMTP for the participant mails (or Settings → Email)           |
| `MAIL_ADMIN_ADDRESS`, `MAIL_CONTACT_ADDRESS`              | who hears of registrations; the address mails name             |
| `LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN` | listmonk API (URL without `/api`), newsletter only             |
| `LISTMONK_LIST_IDS`                                       | numeric newsletter list IDs, comma-separated                   |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT`                | analytics at build time; none unless both are set              |

4. Open `/_emdash/admin` once and create the first admin with a passkey (the setup wizard).
   Invite further people under Users.
5. No scheduled task: the plugin's cron runs inside the server.

### Moving from the old database

The previous backend kept its data in `/data/mens-circle.db`. Once, after the first
deploy of this version:

```bash
docker exec -u bun <container> bun scripts/migrate-to-emdash.ts /data/mens-circle.db /data/migration.json
docker exec -u bun -w /data <container> bunx --bun emdash seed /data/migration.json --database /data/emdash.db --skip-media
```

It brings over every event (descriptions become Portable Text), the registrations of
upcoming events under their old ids (cancel links in mails already sent keep working)
and the voices without their addresses. Waitlisted, cancelled and past registrations stay
behind. Restart the application afterwards (the route cache still holds the empty pages).
Keep `mens-circle.db` until the site looks right, then delete it.

## Operations

| When (UTC)   | What                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| every 15 min | reminder pass; mails leave only 18:00–22:00 Berlin the evening before or from 10:00 on the day |
| 02:30 daily  | retention: registrations `RETENTION_DAYS` (≤ 30) after their event anonymised and trashed      |

Trashed registrations hold no personal data; empty the trash in the admin to remove them.
Back up `/data` (the database and `sessions/`) with Coolify's volume backups.

## Content

- Events, registrations, voices: `/_emdash/admin`. A sign-up arrives as a published
  registration; a cancellation sets "Abgesagt am" and frees the seat. A full evening takes
  no sign-ups (no waiting list). A submitted voice arrives as a draft; publishing shows it.
- Page content and section order: directly in `src/pages/*.astro`
- Section markup: `src/components/blocks/`; content arrives as explicit props and slots at its page location
- Home, `/event` and event pages: server-rendered dates, seats and approved voices from EmDash
  (`src/lib/server/content.ts`); no content hydration
- Route cache: Astro's `memoryCache()` (path-keyed, 64 entries), 5 minutes + 5 minutes
  stale-while-revalidate, tagged with the collection names, so EmDash purges it on every
  publish; the forms purge it after a sign-up
- Default `Cache-Control` and the CSRF origin check: `src/middleware.ts`, `src/lib/cache-policy.ts`
- Participant mails: `src/lib/server/mail/`, sent through EmDash's email pipeline
- Design: see [design system](docs/design-system.md); runtime: [runtime](docs/runtime.md)
- Live-seat JSON, cache lifetimes and privacy boundary: `docs/public-api.md`
- Legal pages: `src/pages/impressum.astro`, `src/pages/datenschutz.astro` (prerendered)
- Site settings, navigation: `src/data/site.json`, `src/data/navigation.json`
- Newsletter: listmonk admin; its campaign template is in `listmonk-templates/`
