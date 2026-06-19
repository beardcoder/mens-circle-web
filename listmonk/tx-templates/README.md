# listmonk transactional templates

The web app sends all event emails through listmonk's **transactional API**
(`POST /api/tx`). Each email type is a **transactional template** maintained in
listmonk; the app only passes a data payload (`{{ .Tx.Data.<field> }}`). This
keeps the markup editable in listmonk and the data/subject logic in the app.

## One-time setup in the listmonk UI

For each file in this folder (except `_layout-snippet.html`):

1. listmonk → **Campaigns → Templates → New**.
2. **Type:** `Transactional`.
3. **Name:** anything descriptive (e.g. „Anmeldebestätigung").
4. **Subject:** `{{ .Tx.Data.subject }}` — the app builds the German subject
   line and passes it in the data payload.
5. **Body:** paste the full contents of the corresponding `*.html` file.
6. Save and note the **numeric template ID** (visible in the URL / list).

Then set the matching environment variables (see `.env.example`):

| File | Env var | Used for |
|---|---|---|
| `registration-confirmation.html` | `LISTMONK_TX_REGISTRATION_CONFIRMATION` | Anmeldebestätigung |
| `waitlist-confirmation.html` | `LISTMONK_TX_WAITLIST_CONFIRMATION` | Warteliste-Bestätigung |
| `admin-notification.html` | `LISTMONK_TX_ADMIN_NOTIFICATION` | Admin-Benachrichtigung |
| `waitlist-promotion.html` | `LISTMONK_TX_WAITLIST_PROMOTION` | Nachrücken von der Warteliste |
| `event-reminder.html` | `LISTMONK_TX_EVENT_REMINDER` | Erinnerung (heute/morgen) |
| `event-message.html` | `LISTMONK_TX_EVENT_MESSAGE` | Freie Nachricht an Teilnehmer |

If a template ID is left empty the corresponding email is simply skipped (and a
line is logged) — useful while you set them up one at a time.

## How sending works

- The app ensures the recipient exists as a listmonk subscriber (a requirement
  of `/api/tx`), then posts `{ subscriber_id, template_id, data, content_type:
  "html", from_email }`.
- The templates auto-escape all values (Go `html/template`). Multiline free text
  (`description`, `locationDetails`, `content`) is rendered inside a
  `white-space: pre-line` block, so line breaks display without raw HTML.
- listmonk must have working SMTP configured (Settings → SMTP), same as for the
  newsletter.

> Note: transactional templates live in listmonk's **database**, not the
> file system, so they are **not** auto-seeded by `--static-dir` (that only
> overlays the file-based *system* templates). Create them once in the UI as
> described above.
