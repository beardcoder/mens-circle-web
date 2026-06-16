# PocketBase Backend — Männerkreis Niederbayern/ Straubing

PocketBase (v0.23+ JSVM) backend that serves the static frontend, the public API,
the admin dashboard, transactional email and a reminder cron. Built entirely from
JS migrations (`pb_migrations/`) and JS-VM hooks (`pb_hooks/`).

## Collections

| Collection | Type | Public read | Notes |
|---|---|---|---|
| `participants` | base | no (superuser) | Shared, deduped by **unique email**. PII. |
| `events` | base | only `is_published = true && deleted = null` | Slug unique, auto-generated from `event_date` as `YYYY-MM-DD` (e.g. `/event/2026-06-12`) when left empty — same-day collisions get a `-2`/`-3` suffix; a manual slug is respected (`events.pb.js`). Soft-delete via `deleted` date. |
| `registrations` | base | no (superuser) | Unique `(participant, event)`. Status: `registered` / `waitlist` / `cancelled` / `attended`. Created via the custom route, not public record create. |
| `testimonials` | base | only `is_published = true` | Submitted via custom route, forced unpublished for moderation. |
| `next_event_registrations` | **view** (read-only) | no (superuser) | Dashboard view: everyone registered for the **next** upcoming event with participant details. |

A single published sample event (`maennerkreis-test-termin`) is seeded so the public
`/event` page works out of the box (guarded against duplicate seeding).

> **Newsletter lives in listmonk.** Subscribers and campaigns are no longer stored
> in PocketBase. The former `newsletter_subscribers` and `newsletters` collections
> are dropped by migration `1700000900`. See [Newsletter](#newsletter-listmonk) below.

### `next_event_registrations` view

A read-only SQL view collection (browse it in the admin under
Collections → `next_event_registrations`) listing every active registration
(`registered` / `waitlist` / `attended`, excluding soft-deleted/cancelled) for the
next published, non-deleted, future event. Columns: `first_name`, `last_name`,
`email`, `phone`, `status`, `registered_at`, `event_title`, `event_date`. Ordered
registered → attended → waitlist, then by signup time. Superuser-only (PII).

### Capacity / waitlist logic (all computed, never stored)

- **active registration** = status in `{registered, attended}` and `deleted = null`.
- **available_spots** = `max(0, max_participants − activeCount)`.
- **is_full** = `available_spots <= 0`.
- **is_past** = end of `event_date` day is in the past.

## Routes

### Public

| Method | Path | Body / Params | Returns |
|---|---|---|---|
| POST | `/api/event/register` | `{event_id, first_name, last_name, email, phone_number, privacy}` | `{success, message}` |
| POST | `/api/newsletter/subscribe` | `{email, name?}` | `{success, message}` — forwards to listmonk |
| POST | `/api/testimonial/submit` | `{quote, author_name, role, email, privacy}` | `{success, message}` |
| GET | `/api/public/events/next` | — | `{event: DTO | null}` |
| GET | `/api/public/events/{slug}` | slug | `{event: DTO | null}` (404 if missing) |

The event DTO contains the stored event fields plus computed `available_spots`,
`is_full`, `is_past`, and `image_url` (null if no image).

**Registration decision flow** (`POST /api/event/register`): validate privacy →
404 if unpublished/deleted (`Diese Veranstaltung ist nicht verfügbar.`) →
410 if past → compute waitlist by capacity → upsert participant by email →
find existing registration (incl. soft-deleted): reject 409 if active, restore if
soft-deleted, else create. Confirmation / waitlist / admin emails fire from the
`registrations` create hook (or inline on the restore path).

There are no admin (superuser) API routes — newsletter campaigns are authored and
sent inside listmonk, not via a PocketBase route.

## Newsletter (listmonk)

Newsletter subscribers and campaign sending live in **listmonk**, not PocketBase:

- **Sign-up:** `POST /api/newsletter/subscribe` (honeypot + rate-limited, see below)
  validates the email and forwards it to listmonk's admin API
  (`POST /api/subscribers`, added without `preconfirm_subscriptions` so listmonk
  drives the configured double opt-in). A 409 from listmonk maps to the friendly
  "bereits angemeldet" response.
- **Opt-in / unsubscribe / sending:** all owned by listmonk (its own confirmation
  email, unsubscribe page and campaign editor). PocketBase emits none of these.
- **Config:** `LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`,
  `LISTMONK_LIST_IDS` (see Environment variables). If unset, sign-ups fail and a
  warning is logged at boot.

## Emails

All German, "du"-form, signed `Herzliche Grüße, Männerkreis Niederbayern/ Straubing`.
From `hallo@mens-circle.de`. Renderers live in `pb_hooks/lib.js` and return
`{ subject, html }` (inline-styled, email-safe HTML).

| # | Email | Trigger | Subject (verbatim) |
|---|---|---|---|
| 1 | Registration confirmation | registration create/restore, status `registered` | `Anmeldebestätigung: {title}` |
| 2 | Admin notification | every registration create/restore | `Neue Anmeldung: {title}` |
| 3 | Waitlist confirmation | registration create/restore, status `waitlist` | `Warteliste: {title}` |
| 4 | Waitlist promotion | registration status → `cancelled` (next FIFO promoted) | `Ein Platz ist frei – {title}` |
| 5 | Event reminder | cron, event today/tomorrow, not yet reminded | `Erinnerung: {title} ist {heute\|morgen}!` |
| 6 | Event participant message | (renderer available in lib.js) | `{custom subject}` |

Newsletter welcome + campaign emails are sent by listmonk, not PocketBase.

Emails 1 and 4 attempt to attach an iCal `.ics` (VCALENDAR, `TZID=Europe/Berlin`,
UID `{event.id}@mens-circle.de`). The HTML also contains a calendar note so mail is
never blocked if the attachment API differs on the target build.

Mail sending is wrapped so a failure is logged and never 500s the originating request
(a registration still succeeds even if its confirmation email fails).

## Cron

`event-reminders` runs `*/15 * * * *`: finds active, not-yet-reminded registrations
whose published event falls today or tomorrow, sends the `heute`/`morgen` reminder,
and sets `reminder_sent_at` (+ `sms_reminder_sent_at` if the participant has a phone
— actual SMS sending is a TODO). Idempotent via `reminder_sent_at`.

## Environment variables

Read in `pb_hooks/lib.js` via `$os.getenv` with defaults:

| Var | Default |
|---|---|
| `APP_URL` | `https://mens-circle.de` |
| `SITE_NAME` | `Männerkreis Niederbayern/ Straubing` |
| `MAIL_FROM_ADDRESS` | `hallo@mens-circle.de` |
| `MAIL_FROM_NAME` | `Männerkreis Niederbayern/ Straubing` |
| `MAIL_ADMIN_ADDRESS` | `hallo@mens-circle.de` |
| `MAIL_ADMIN_NAME` | `Männerkreis Admin` |
| `MAIL_CONTACT_ADDRESS` | `hallo@mens-circle.de` |
| `LISTMONK_URL` | _(empty)_ — base URL of the listmonk instance, no trailing slash |
| `LISTMONK_API_USER` | _(empty)_ — listmonk API user |
| `LISTMONK_API_TOKEN` | _(empty)_ — listmonk API token |
| `LISTMONK_LIST_IDS` | _(empty)_ — comma-separated numeric list ID(s), e.g. `1,3` |

SMTP itself is configured in PocketBase Settings → Mail settings (or via the standard
PB mailer env), not in these hooks. It powers the transactional **event** emails only;
the newsletter has its own SMTP configured inside listmonk.

## File layout

```
pb_migrations/
  1700000000_init_participants.js
  1700000100_init_events.js
  1700000200_init_registrations.js
  1700000300_init_newsletter_subscribers.js   # superseded by 1700000900 (dropped)
  1700000400_init_newsletters.js              # superseded by 1700000900 (dropped)
  1700000500_init_testimonials.js
  1700000600_seed_sample_event.js
  1700000900_drop_newsletter_collections.js   # newsletter moved to listmonk
pb_hooks/
  lib.js               # shared config, formatters, ICS builder, mail helper, listmonk client, email renderers (NOT auto-loaded)
  config.pb.js         # boot-time config log
  registrations.pb.js  # create emails + waitlist promotion on cancel
  routes_public.pb.js  # public POST/GET routes (incl. newsletter → listmonk)
  cron.pb.js           # event reminder cron
```

`lib.js` is required from each `*.pb.js` via ``require(`${__hooks}/lib.js`)`` because
PocketBase hook files do not share scope across files.
