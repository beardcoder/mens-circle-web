# PocketBase Backend — Männerkreis Niederbayern/ Straubing

PocketBase (v0.23+ JSVM) backend that serves the static frontend, the public API,
the admin dashboard, transactional email and a reminder cron. Built entirely from
JS migrations (`pb_migrations/`) and JS-VM hooks (`pb_hooks/`).

## Collections

| Collection | Type | Public read | Notes |
|---|---|---|---|
| `participants` | base | no (superuser) | Shared, deduped by **unique email**. PII. |
| `events` | base | only `is_published = true && deleted = null` | Slug unique. Soft-delete via `deleted` date. |
| `registrations` | base | no (superuser) | Unique `(participant, event)`. Status: `registered` / `waitlist` / `cancelled` / `attended`. Created via the custom route, not public record create. |
| `newsletter_subscribers` | base | no (superuser) | One per participant (unique). Unique `token` for the unsubscribe link. |
| `newsletters` | base | no (superuser) | Admin-authored campaigns. Status: `draft` / `sending` / `sent`. |
| `testimonials` | base | only `is_published = true` | Submitted via custom route, forced unpublished for moderation. |
| `next_event_registrations` | **view** (read-only) | no (superuser) | Dashboard view: everyone registered for the **next** upcoming event with participant details. |

A single published sample event (`maennerkreis-test-termin`) is seeded so the public
`/event` page works out of the box (guarded against duplicate seeding).

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
| POST | `/api/newsletter/subscribe` | `{email}` | `{success, message}` |
| POST | `/api/testimonial/submit` | `{quote, author_name, role, email, privacy}` | `{success, message}` |
| GET | `/api/public/events/next` | — | `{event: DTO | null}` |
| GET | `/api/public/events/{slug}` | slug | `{event: DTO | null}` (404 if missing) |
| GET | `/newsletter/unsubscribe/{token}` | token | German HTML confirmation page |

The event DTO contains the stored event fields plus computed `available_spots`,
`is_full`, `is_past`, and `image_url` (null if no image).

**Registration decision flow** (`POST /api/event/register`): validate privacy →
404 if unpublished/deleted (`Diese Veranstaltung ist nicht verfügbar.`) →
410 if past → compute waitlist by capacity → upsert participant by email →
find existing registration (incl. soft-deleted): reject 409 if active, restore if
soft-deleted, else create. Confirmation / waitlist / admin emails fire from the
`registrations` create hook (or inline on the restore path).

### Admin (superuser only)

| Method | Path | Action |
|---|---|---|
| POST | `/api/admin/newsletters/{id}/send` | Sets status `sending`, sends the campaign to all active subscribers in chunks of 100 (per-recipient `{first_name}` substitution + token unsubscribe footer), then sets `sent` + `sent_at` + `recipient_count`. Reverts to `draft` on total failure. |

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
| 6 | Newsletter welcome | new/restored subscription | `Willkommen beim Männerkreis Niederbayern/ Straubing Newsletter` |
| 7 | Newsletter campaign | admin send route | `{newsletter.subject}` |
| 8 | Event participant message | (renderer available in lib.js) | `{custom subject}` |

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

SMTP itself is configured in PocketBase Settings → Mail settings (or via the standard
PB mailer env), not in these hooks.

## File layout

```
pb_migrations/
  1700000000_init_participants.js
  1700000100_init_events.js
  1700000200_init_registrations.js
  1700000300_init_newsletter_subscribers.js
  1700000400_init_newsletters.js
  1700000500_init_testimonials.js
  1700000600_seed_sample_event.js
pb_hooks/
  lib.js               # shared config, formatters, ICS builder, mail helper, email renderers (NOT auto-loaded)
  config.pb.js         # boot-time config log
  registrations.pb.js  # create emails + waitlist promotion on cancel
  newsletter.pb.js     # welcome email on subscribe
  routes_public.pb.js  # public POST/GET routes
  routes_admin.pb.js   # superuser newsletter send
  cron.pb.js           # event reminder cron
```

`lib.js` is required from each `*.pb.js` via ``require(`${__hooks}/lib.js`)`` because
PocketBase hook files do not share scope across files.
