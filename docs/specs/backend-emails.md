# Backend Data Model + Email Specification (PocketBase rebuild)

Source of truth: the existing Laravel app at `/Users/markus.sommer/Projekte/Privat/mens-circle`
("Männerkreis Niederbayern/ Straubing", a German men's-circle site). This document maps the
Laravel data model and email flows onto a PocketBase (latest single Go binary) backend using
`pb_hooks` (JS) for transactional email and `$app.cron()` for scheduled jobs.

Site name (verbatim): **Männerkreis Niederbayern/ Straubing**

---

## 1. PocketBase Collection Schemas

### Conventions

- PB auto-provides `id`, `created`, `updated` on every collection — the Laravel `created_at`/`updated_at`
  map to `created`/`updated`.
- Laravel uses `softDeletes` (a `deleted_at` column) for events, registrations, testimonials,
  newsletter_subscriptions. PB has **no native soft delete**. Recommended approach: add an explicit
  `deleted` (date, nullable) field on collections where the cancel/restore logic depends on it
  (most importantly `registrations` and `newsletter_subscriptions`, whose "restore on
  re-registration / re-subscribe" logic is load-bearing — see §2). For `events` and `testimonials`,
  soft delete can be dropped in favour of hard delete unless an admin trash is desired.
- The Laravel `users` table maps to PB's built-in `_superusers` (admins for the dashboard) — the
  public site has no end-user login. Keep admins as superusers.

---

### 1.1 `events` (type: **base**)

| Field              | PB type          | Required | Notes                                                                                                                                                   |
| ------------------ | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`            | text             | yes      |                                                                                                                                                         |
| `slug`             | text             | yes      | **unique**. In Laravel auto-generated from `event_date` (`Y-m-d`). Reproduce in a hook or compute client-side.                                          |
| `description`      | editor (or text) | no       | rendered as multi-line / nl2br in emails                                                                                                                |
| `event_date`       | date             | yes      | full timestamp; date portion drives slug + scheduling                                                                                                   |
| `start_time`       | text             | yes      | stored as `HH:MM` time-of-day (Laravel `time`). PB has no time-only type → use `text` `HH:MM`, or fold into `event_date`.                               |
| `end_time`         | text             | yes      | same as above                                                                                                                                           |
| `location`         | text             | yes      | default `"Straubing"`                                                                                                                                   |
| `location_details` | text             | no       |                                                                                                                                                         |
| `street`           | text             | no       |                                                                                                                                                         |
| `postal_code`      | text             | no       |                                                                                                                                                         |
| `city`             | text             | no       |                                                                                                                                                         |
| `latitude`         | number           | no       | decimal(10,7)                                                                                                                                           |
| `longitude`        | number           | no       | decimal(10,7)                                                                                                                                           |
| `max_participants` | number           | yes      | default `8`                                                                                                                                             |
| `cost_basis`       | text             | yes      | default `"Auf Spendenbasis"`                                                                                                                            |
| `is_published`     | bool             | yes      | default `false`                                                                                                                                         |
| `image`            | file (single)    | no       | Laravel uses Spatie MediaLibrary `event_image` collection (single file, webp conversion). PB: single `file` field; generate a thumb via PB thumb sizes. |
| `deleted`          | date             | no       | optional soft-delete marker                                                                                                                             |

Computed (not stored — see §2): `availableSpots`, `isFull`, `isPast`, `fullAddress`, `hasCoordinates`,
`activeRegistrationsCount`.

**API rules**: public read **only for published, non-deleted** events.
`listRule`/`viewRule`: `is_published = true && deleted = null`. create/update/delete: superuser only.

---

### 1.2 Participant data — DECISION: separate `participants` collection (do NOT embed as JSON)

The Laravel schema deliberately refactored away from per-registration name/email into a shared
`participants` table (migration `2026_01_18_000001_refactor_to_participant_schema.php`). One
participant (keyed by unique email) is reused across many event registrations **and** their newsletter
subscription. Embedding participant data as JSON on each registration would break:

- the unique-email dedup (`Participant::findOrCreateByEmail`, `updateOrCreate(['email' => …])`),
- the link between a registration and the newsletter subscription,
- the "update participant details on re-registration" behaviour.

So keep `participants` as its own base collection and use PB **relations**.

#### `participants` (type: **base**)

| Field        | PB type | Required | Notes                                                                         |
| ------------ | ------- | -------- | ----------------------------------------------------------------------------- |
| `first_name` | text    | no       | nullable since `2026_01_19_120000` (newsletter-only signups have empty names) |
| `last_name`  | text    | no       | nullable                                                                      |
| `email`      | email   | yes      | **unique**                                                                    |
| `phone`      | text    | no       |                                                                               |

Computed: `fullName` = `trim(first_name + " " + last_name)`.

**API rules**: contains PII → **no public read**. Created indirectly by registration/newsletter
hooks (server-side, superuser context). All rules superuser-only.

---

### 1.3 `registrations` (type: **base**) — was `event_registrations`

| Field                  | PB type                 | Required | Notes                                                                            |
| ---------------------- | ----------------------- | -------- | -------------------------------------------------------------------------------- |
| `participant`          | relation → participants | yes      | single, cascade delete                                                           |
| `event`                | relation → events       | yes      | single, cascade delete                                                           |
| `status`               | select (single)         | yes      | values: `registered`, `waitlist`, `cancelled`, `attended`. Default `registered`. |
| `registered_at`        | date                    | yes      | set to now on create                                                             |
| `cancelled_at`         | date                    | no       | set when status → cancelled                                                      |
| `reminder_sent_at`     | date                    | no       | idempotency guard for reminder cron                                              |
| `sms_reminder_sent_at` | date                    | no       | set when SMS reminder sent (only if phone present)                               |
| `deleted`              | date                    | no       | soft-delete marker (cancel/restore logic, see §2)                                |

**Unique constraint**: `(participant, event)` — one registration per participant per event.
PB: composite unique index on `participant + event`.

**Status enum labels (German, for admin UI)**: Registered=`Angemeldet`, Waitlist=`Warteliste`,
Cancelled=`Abgesagt`, Attended=`Teilgenommen`.

**API rules**:

- **create: public** (the public registration form posts here) — but capacity/waitlist/dedup logic
  must run in an `onRecordCreate*` hook, not be trusted from the client (see §2).
- read/update/delete: superuser only (participants never list other registrations).

> Note: the public registration endpoint in Laravel accepts `first_name`, `last_name`, `email`,
> `phone_number`, `privacy` (must be accepted) + `event_id`. In PB the cleanest port is a **custom
> route** (`routerAdd("POST", "/api/event/register", …)`) that does participant upsert + capacity
> check + create registration + fire emails, rather than a raw record create. See §5.

---

### 1.4 `newsletter_subscribers` (type: **base**) — was `newsletter_subscriptions`

| Field             | PB type                 | Required | Notes                                                  |
| ----------------- | ----------------------- | -------- | ------------------------------------------------------ |
| `participant`     | relation → participants | yes      | single, **unique**, cascade delete                     |
| `token`           | text                    | yes      | **unique**, random 64-char; used for unsubscribe link  |
| `subscribed_at`   | date                    | yes      | now on create                                          |
| `confirmed_at`    | date                    | no       | (no double-opt-in flow currently; set = subscribed_at) |
| `unsubscribed_at` | date                    | no       | null = active                                          |
| `deleted`         | date                    | no       | soft-delete marker                                     |

Computed: `isActive` = `unsubscribed_at == null`.

**API rules**: PII + list of all subscribers → **admin-only read** (`listRule`/`viewRule` = superuser).
Create handled by custom subscribe route (upsert participant, restore-or-create subscription).

---

### 1.5 `newsletters` (type: **base**)

| Field             | PB type | Required | Notes                                                             |
| ----------------- | ------- | -------- | ----------------------------------------------------------------- |
| `subject`         | text    | yes      | used verbatim as the email subject                                |
| `content`         | editor  | yes      | HTML; supports `{first_name}` placeholder, replaced per-recipient |
| `status`          | select  | yes      | values: `draft`, `sending`, `sent`. Default `draft`.              |
| `sent_at`         | date    | no       | set when batch completes                                          |
| `recipient_count` | number  | no       | default `0`; number successfully sent                             |

Status labels (DE): Draft=`Entwurf`, Sending=`Wird gesendet`, Sent=`Gesendet`.

**API rules**: superuser only (admin-authored). Sending triggered by admin action → cron/queue
hook iterates active subscribers (see §4).

---

### 1.6 `testimonials` (type: **base**)

| Field          | PB type | Required | Notes                             |
| -------------- | ------- | -------- | --------------------------------- |
| `quote`        | text    | yes      | 10–1000 chars                     |
| `author_name`  | text    | no       |                                   |
| `email`        | email   | no       | captured on submission; nullable  |
| `role`         | text    | no       |                                   |
| `is_published` | bool    | yes      | default `false` (admin moderates) |
| `published_at` | date    | no       |                                   |
| `sort_order`   | number  | yes      | default `0`                       |
| `deleted`      | date    | no       | optional soft-delete              |

Laravel applies a global ordering scope (`OrderedTestimonialScope`) — typically `sort_order` then
recency. Reproduce as a `sort` param on the public query.

**API rules**:

- **create: public** (submission form `/api/testimonial/submit`) — always forced to
  `is_published=false`, `published_at=null`, `sort_order=0`.
- **read: public but only published** → `listRule`/`viewRule`: `is_published = true`.
- update/delete: superuser only.

---

### 1.7 Supporting collections (CMS — port if the PB build also serves content; otherwise out of scope)

These back the Laravel-rendered pages and are **not** part of the email flows. Include if PB is the
full CMS, skip if the frontend keeps its own content.

- **`pages`** (base): `title` text; `slug` text unique; `meta` json (nullable); `is_published` bool;
  `published_at` date. Public read only published.
- **`content_blocks`** (base): `type` text; `data` json; `block_id` text unique; `order` number;
  `page` relation → pages (nullable, cascade). Ordered by `(page, order)`.
- **`navigation_items`** (base): `location` select; `label` text; `url` text; `anchor` text(null);
  `condition` select(null); `open_in_new_tab` bool; `is_cta` bool; `is_visible` bool;
  `umami_event_target` text(null); `sort` number. Public read where `is_visible = true`.
- **`settings`** — see §6; better as PB settings/params than a collection.
- **`media`** (Spatie MediaLibrary) → replace with native PB `file` fields per collection.

---

## 2. Event Capacity / Waitlist Logic

All "capacity" values are **computed**, never stored on the event. Definitions (from `Event.php` /
`Registration.php`):

- **active registration** = status in `{registered, attended}` AND not soft-deleted.
- **activeRegistrationsCount** = `count(registrations where event = E and status in {registered,attended} and deleted = null)`.
- **availableSpots** = `max(0, event.max_participants - activeRegistrationsCount)`.
- **isFull** = `availableSpots <= 0`.
- **isPast** = `event.event_date` (end of that day) is in the past.

### Registration decision flow (Laravel `RegisterForEvent` action — must be reproduced server-side):

1. Reject if event not published → 404 message `"Diese Veranstaltung ist nicht verfügbar."`
2. Reject if `isPast` → 410 `"Diese Veranstaltung hat bereits stattgefunden. Eine Anmeldung ist nicht mehr möglich."`
3. `isWaitlist = event.isFull` (computed at submit time).
4. **Upsert participant** by email (`updateOrCreate` on email): update first_name/last_name/phone.
5. Look for an existing registration for `(participant, event)` **including soft-deleted**:
   - exists and **not** deleted → reject 409:
     - if its status is `waitlist`: `"Du bist bereits auf der Warteliste für diese Veranstaltung."`
     - else: `"Du bist bereits für diese Veranstaltung angemeldet."`
   - exists and soft-deleted → **restore**: set status = (`waitlist` if full else `registered`),
     `registered_at = now`, `cancelled_at = null`, clear `deleted`.
   - none → create with status (`waitlist`/`registered`), `registered_at = now`.
6. Send participant email + admin notification (see §4).
7. API success responses (verbatim):
   - normal: `"Vielen Dank, {firstName}! Deine Anmeldung war erfolgreich. Du erhältst in Kürze eine Bestätigung per E-Mail."`
   - waitlist: `"Du wurdest auf die Warteliste eingetragen, {firstName}. Wir benachrichtigen dich per E-Mail, sobald ein Platz frei wird."`

### Waitlist promotion (Laravel `RegistrationObserver::updated`):

When a registration's status **changes to `cancelled`**:

1. Find the next waitlisted registration for the same event, ordered by `registered_at` ASC (FIFO).
2. If found: promote it to `registered` (this itself does not re-trigger promotion since the guard
   only fires on transition _to_ cancelled).
3. Send that participant the **waitlist-promotion** email.

In PB: implement in `onRecordUpdate` (or `onRecordAfterUpdateSuccess`) for `registrations`, comparing
old vs new `status`. Capacity counts should be computed via a query at decision time (not cached).

> There is **no waitlist "position" number stored**; position is implicit FIFO ordering by
> `registered_at`. If a numeric position is needed for display, compute:
> `count(waitlisted for event with registered_at <= mine) `.

---

## 3. Email Specification

Brand from-address: **hallo@mens-circle.de** / from-name **Männerkreis Niederbayern/ Straubing**
(`MAIL_FROM_*`). Admin notifications go to **hallo@mens-circle.de** / **Männerkreis Admin**
(`MAIL_ADMIN_*`). Contact address referenced in copy: `hallo@mens-circle.de`.
All emails are German, "du"-form, signed `Herzliche Grüße, **{site_name}**` (signature copy says
"Markus" in some newsletter templates).

| #   | Email                               | Trigger                                                                        | Recipient              | Subject (verbatim)                                                           | Content summary / key copy                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------- | ------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Event registration confirmation     | Successful non-waitlist registration                                           | Participant            | `Anmeldebestätigung: {event.title}`                                          | "Hallo {first_name}, du bist dabei!" — confirms reserved spot; **Dein Termin** block (Datum `l, d. F Y`, Uhrzeit `H:i–H:i Uhr`, Ort, Adresse, Hinweis); "Was dich erwartet" = event description; "Teilnahme: {cost_basis}"; "Gut zu wissen" bullets (Komm pünktlich…, offene Haltung…, Fragen an hallo@mens-circle.de). **iCal `.ics` attachment** `event-{slug}.ics`. Tracking pixel `event_registration_open`. |
| 2   | Admin new-registration notification | Same registration event (any registration incl. waitlist)                      | Admin(s) (all `users`) | `Neue Anmeldung: {event.title}`                                              | "Neue Anmeldung" / event title; **Teilnehmer** (Name, E-Mail, Telefon if present); **Veranstaltung** (Datum `d.m.Y`, Uhrzeit, Ort, Plätze `{count} / {max_participants}`). Also Pushover push if configured.                                                                                                                                                                                                     |
| 3   | Waitlist confirmation               | Successful registration when event is full                                     | Participant            | `Warteliste: {event.title}`                                                  | "Du bist auf der Warteliste!" — "Wir benachrichtigen dich sofort, wenn ein Platz frei wird." Event block; "Was jetzt?" = informed automatically, nothing to do, cancel via hallo@mens-circle.de. No iCal.                                                                                                                                                                                                        |
| 4   | Waitlist promotion                  | A registration is cancelled and this person is next on the waitlist            | Promoted participant   | `Ein Platz ist frei – {event.title}`                                         | "Ein Platz ist frei!" — "du rückst von der Warteliste auf!" spot now reserved; full event/termin block; "Was dich erwartet" = description; "Teilnahme"; "Gut zu wissen" bullets. **iCal `.ics` attachment**.                                                                                                                                                                                                     |
| 5   | Event reminder                      | Scheduled — event is today or tomorrow, reminder not yet sent                  | Active participants    | `Erinnerung: {event.title} ist {heute\|morgen}!`                             | "{Heute\|Morgen} ist es soweit!" — termin block; "Zur Erinnerung" = description; "Teilnahme"; "Bitte beachten" bullets (pünktlich, offene Haltung, kurzfristig verhindert → hallo@mens-circle.de); closes "Bis {gleich\|morgen}!". Pixel `event_reminder_open`. SMS variant via seven.io if phone present.                                                                                                       |
| 6   | Newsletter welcome                  | New newsletter subscription (or re-subscribe)                                  | Subscriber             | `Willkommen beim Männerkreis Niederbayern/ Straubing Newsletter`             | "Hallo {first_name}, Schön, dass du dabei bist." — "Was dich erwartet": **Neue Termine**, **Inspirierende Impulse**, **Besondere Einladungen**; CTA "Nächste Termine ansehen"; quote about "Raum für echte Begegnung"; unsubscribe link via token. Pixel `newsletter_welcome_open`.                                                                                                                              |
| 7   | Newsletter (campaign)               | Admin sends a newsletter (batch)                                               | All active subscribers | `{newsletter.subject}` (admin-authored)                                      | Renders `newsletter.content` HTML with `{first_name}` substituted per recipient; standard footer + token unsubscribe link (`newsletter.unsubscribe`). Pixel `newsletter_open`.                                                                                                                                                                                                                                   |
| 8   | Event participant message           | Admin sends an ad-hoc/templated message to all active participants of an event | Active participants    | `{custom subject}` (admin-supplied; templates exist in `EmailTemplate` enum) | Renders supplied HTML `content` with `{first_name}` substituted; footer "Diese E-Mail wurde gesendet, weil du für die Veranstaltung „{event.title}" angemeldet bist."                                                                                                                                                                                                                                            |

### Reusable email content templates (`EmailTemplate` enum) — for newsletters / participant messages

Admin can pick a template; placeholders are substituted before send. Placeholders:
`{first_name} {event_title} {event_date} {event_time} {event_location} {event_url} {available_spots} {cost_basis} {site_name}`.

- **`newsletter_new_event`** — subject `Neues Treffen: {event_title} am {event_date}` — "Ein neues
  Treffen steht an" announcement with event box, invitation copy, "Es sind noch {available_spots}
  Plätze frei.", CTA "Jetzt anmelden", signed Markus.
- **`newsletter_event_reminder`** — subject `Bald ist es soweit – {event_title} am {event_date}` —
  "Unser Treffen rückt näher!", free spots remaining, CTA "Jetzt Platz sichern".
- **`participant_pre_event`** — subject `{event_title} steht bevor – wir freuen uns auf dich` —
  "Es ist bald soweit!", reflection prompts ("Wie geht es dir gerade – wirklich?" …), reminders
  (pünktlich, offene Haltung, Bescheid geben), CTA "Alle Details zum Treffen".

---

## 4. Automatic (on-create) vs. Batch / Scheduled

### Fire automatically on record create/update → `pb_hooks` `onRecord*Success`

| Email                                   | Hook                                                                                                                                | Trigger condition                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| (1) Event registration confirmation     | after a registration is created with `status=registered` (or restored to registered)                                                | inside the custom register route / `onRecordAfterCreateSuccess("registrations")` |
| (3) Waitlist confirmation               | after a registration created/restored with `status=waitlist`                                                                        | same hook, branch on status                                                      |
| (2) Admin new-registration notification | after **any** registration create                                                                                                   | same hook; recipient = admin address                                             |
| (4) Waitlist promotion                  | `onRecordAfterUpdateSuccess("registrations")` when old status ≠ cancelled and new = cancelled → promote next, email promoted person | update hook                                                                      |
| (6) Newsletter welcome                  | after a `newsletter_subscribers` record is created (or re-activated)                                                                | subscribe route / `onRecordAfterCreateSuccess("newsletter_subscribers")`         |

### Batch / scheduled → `$app.cron()` and admin-triggered jobs

| Email                         | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (5) Event reminder            | **Cron**, every 15 min in Laravel (`SendEventReminders`). PB: `$app.cron().add("event-reminders", "*/15 * * * *", …)`. Query active registrations whose event is published and `event_date` ∈ [today 00:00, tomorrow 23:59] and `reminder_sent_at` is null; send reminder; set `reminder_sent_at = now` (and `sms_reminder_sent_at` if phone). `isToday` = event_date is today.                                                                                                                                                                                                  |
| (7) Newsletter campaign       | **Admin-triggered batch** (Laravel `SendNewsletterJob`, queued, unique per newsletter). PB has no queue → run inside a goroutine-style routine: set newsletter `status=sending`; iterate active subscribers in chunks of 100 (100 ms sleep between chunks); send per-recipient mail with `{first_name}` substituted; on completion set `status=sent`, `sent_at=now`, `recipient_count`; on total failure revert to `draft`. Can be a custom route `POST /api/admin/newsletters/{id}/send` (superuser) that spawns the loop, or a cron that picks up newsletters flagged to send. |
| (8) Event participant message | **Admin-triggered batch** — iterate `event.activeRegistrations`, queue/send `EventParticipantMessage` per participant. Custom superuser route.                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Other scheduled job (not email): `GenerateSitemap` daily at 02:00 — port only if PB serves the site.

---

## 5. Recommended `pb_hooks` File Structure

```
pb_hooks/
  config.pb.js                  # shared constants: from/admin addresses, site name/url, helpers
  email_templates.pb.js         # render functions returning {subject, html} for each email type
  registrations.pb.js           # create + update hooks (confirmation / waitlist / admin / promotion)
  newsletter.pb.js              # subscribe create hook (welcome) + send route (campaign batch)
  testimonials.pb.js            # optional: notify admin of new submission (not in current Laravel app)
  routes_public.pb.js           # POST /api/event/register, /api/newsletter/subscribe,
                                #      /api/testimonial/submit, GET /newsletter/unsubscribe/{token}
  routes_admin.pb.js            # POST /api/admin/newsletters/{id}/send, participant-message send
  cron.pb.js                    # $app.cron() event reminders (+ sitemap if needed)
```

### Hook logic (pseudocode)

**`routes_public.pb.js` — register**

```js
routerAdd('POST', '/api/event/register', (e) => {
  const { event_id, first_name, last_name, email, phone_number, privacy } =
    readBody(e);
  validate(privacy === true, 'Bitte bestätige die Datenschutzerklärung.');
  const event = findEventById(event_id);
  if (!event || event.deleted)
    return json(404, 'Diese Veranstaltung ist nicht verfügbar.');
  if (isPast(event))
    return json(410, 'Diese Veranstaltung hat bereits stattgefunden. ...');

  const activeCount = countActiveRegistrations(event.id);
  const isWaitlist = activeCount >= event.max_participants;

  const participant = upsertParticipantByEmail(email, {
    first_name,
    last_name,
    phone: phone_number,
  });
  const existing = findRegistration(participant.id, event.id, {
    withTrashed: true,
  });
  if (existing && !existing.deleted) {
    return json(
      409,
      existing.status === 'waitlist'
        ? 'Du bist bereits auf der Warteliste für diese Veranstaltung.'
        : 'Du bist bereits für diese Veranstaltung angemeldet.',
    );
  }
  const status = isWaitlist ? 'waitlist' : 'registered';
  const reg = existing
    ? restoreRegistration(existing, status)
    : createRegistration(participant, event, status);

  // emails (could also live in onRecordAfterCreateSuccess)
  isWaitlist
    ? sendWaitlistConfirmation(reg, event, participant)
    : sendRegistrationConfirmation(reg, event, participant); // + iCal attachment
  sendAdminRegistrationNotification(reg, event, participant);

  return json(
    200,
    isWaitlist ? waitlistMsg(first_name) : successMsg(first_name),
  );
});
```

**`registrations.pb.js` — promotion on cancel**

```js
onRecordAfterUpdateSuccess((e) => {
  const oldStatus = e.record.original().get('status');
  const newStatus = e.record.get('status');
  if (!(oldStatus !== 'cancelled' && newStatus === 'cancelled'))
    return e.next();
  const next = findOldestWaitlisted(e.record.get('event')); // order by registered_at ASC
  if (next) {
    next.set('status', 'registered');
    $app.save(next);
    sendWaitlistPromotion(next); // + iCal attachment
  }
  e.next();
}, 'registrations');
```

**`newsletter.pb.js` — welcome + campaign**

```js
// subscribe route: upsert participant, restore-or-create subscription (unique per participant),
// reject if already active ("Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet."),
// generate 64-char token, then:
onRecordAfterCreateSuccess((e) => {
  sendNewsletterWelcome(e.record);
}, 'newsletter_subscribers');

// campaign batch (superuser route):
function sendCampaign(newsletter) {
  newsletter.set('status', 'sending');
  save();
  let count = 0;
  forEachActiveSubscriber((chunk = 100), (sub) => {
    const html = newsletter.content.replaceAll(
      '{first_name}',
      esc(sub.participant.first_name),
    );
    trySend(
      sub.participant.email,
      newsletter.subject,
      html + unsubscribeFooter(sub.token),
    );
    count++;
  });
  newsletter.set({ status: 'sent', sent_at: now(), recipient_count: count });
  save();
}
```

**`cron.pb.js` — reminders**

```js
$app.cron().add('event-reminders', '*/15 * * * *', () => {
  const regs = findActiveRegistrationsForEventsBetween(
    startOfToday(),
    endOfTomorrow(),
  ).filter((r) => !r.reminder_sent_at && r.event.is_published);
  for (const r of regs) {
    const isToday = sameDay(r.event.event_date, today());
    sendEventReminder(r, r.event, isToday);
    r.set('reminder_sent_at', now());
    if (r.participant.phone) r.set('sms_reminder_sent_at', now()); // + actually send SMS via provider
    $app.save(r);
  }
});
```

Each `send*` helper builds the German HTML (see §3 copy) and uses `$app.newMailClient()` /
`$mails` with from = `hallo@mens-circle.de`. iCal `.ics` is generated for emails 1 and 4 (VCALENDAR
with `TZID=Europe/Berlin`, UID `{event.id}@mens-circle.de`).

---

## 6. Settings / Config to externalise

From Laravel `MAIL_*`, `APP_*`, and `GeneralSettings` (spatie/laravel-settings, group `general`).
Store in PB settings (mailer + app params) and an admin-editable `settings` collection or PB
`$app.settings()` meta for the rest.

**Mailer (PB built-in SMTP settings / env):**
| Key | Value (default) |
|---|---|
| SMTP host / port / user / pass | `MAIL_HOST` / `MAIL_PORT` (587) / `MAIL_USERNAME` / `MAIL_PASSWORD` |
| From address | `hallo@mens-circle.de` |
| From name | `Männerkreis Niederbayern/ Straubing` |
| Admin notification address | `hallo@mens-circle.de` |
| Admin notification name | `Männerkreis Admin` |

**App-level:**
| Key | Value (default) |
|---|---|
| Site name / app name | `Männerkreis Niederbayern/ Straubing` (used in every email signature) |
| Site URL | `https://mens-circle.de` (for event URLs, unsubscribe links, iCal UID domain) |
| Contact email (in copy) | `hallo@mens-circle.de` |

**Editable general settings (Laravel `GeneralSettings`)** — keep as a small admin-only collection or
key/value:
`site_name`, `site_tagline`, `site_description`, `contact_email`, `contact_phone` (nullable),
`location`, `whatsapp_community_link` (nullable), `social_links` (json, nullable), `footer_text`,
`event_default_max_participants` (the default `8` for new events).

**Third-party integrations (optional, only if reproduced):**

- Pushover (`services.pushover.token` + `user_key`) — admin push on new registration.
- seven.io (SMS) — participant SMS for registration confirmation & reminders (only if `phone` set).
- Umami / email tracking pixel — `event_registration_open`, `event_reminder_open`,
  `newsletter_open`, `newsletter_welcome_open` events.

---

## Endpoint summary (Laravel → PB)

| Laravel                           | Method | PB equivalent                                                 |
| --------------------------------- | ------ | ------------------------------------------------------------- |
| `/api/event/register`             | POST   | custom route (see §5) — public                                |
| `/api/newsletter/subscribe`       | POST   | custom route — public                                         |
| `/api/testimonial/submit`         | POST   | public create rule on `testimonials` (force unpublished)      |
| `/newsletter/unsubscribe/{token}` | GET    | custom route: find subscriber by token, set `unsubscribed_at` |
