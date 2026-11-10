# listmonk templates

listmonk runs outside this repo; these are the versioned copies of its templates.
Edit here, then paste the file into listmonk (Campaigns → Templates). The template
IDs in the environment stay as they are.

| File | listmonk type | Environment variable |
| --- | --- | --- |
| `tx-registration-confirmation.html` | transactional | `LISTMONK_TX_REGISTRATION_CONFIRMATION` |
| `tx-waitlist-confirmation.html` | transactional | `LISTMONK_TX_WAITLIST_CONFIRMATION` |
| `tx-waitlist-promotion.html` | transactional | `LISTMONK_TX_WAITLIST_PROMOTION` |
| `tx-event-reminder.html` | transactional | `LISTMONK_TX_EVENT_REMINDER` |
| `tx-event-message.html` | transactional | `LISTMONK_TX_EVENT_MESSAGE` |
| `tx-admin-notification.html` | transactional | `LISTMONK_TX_ADMIN_NOTIFICATION` |
| `campaign-mens-circle.html` | campaign | `LISTMONK_CAMPAIGN_TEMPLATE_ID` |

The data each transactional template reads (`{{ .Tx.Data.* }}`) is the payload built
in `src/lib/server/email.ts`; `tests/email-backend` (scenario `template-contract`)
fails when a template reads a field the payload does not send. The campaign template
wraps the body built by `buildEventNewsletterHtml` in `src/lib/server/mail/newsletter.ts` and
adds the greeting, signature, footer and unsubscribe link.

Colours come from `src/lib/shared/brand.ts` (the `--p-*` primitives of `theme.css` by
name, plus the mail-only footer rule); `tests/brand.test.ts` fails when a template
uses a hex value that is not there. Design as on the site (`docs/design-system.md`): three rounded sheets on the sand
page, 8px apart — a forest masthead with the ember mark (`/images/logo-mail.png`,
loaded by URL; mails already sent still load `/images/logo-flame.png`) and the word
mark in Vollkorn, a cream content sheet, a compact forest footer that links Impressum
and Datenschutz and carries no slogan. Vollkorn 500 for titles and the date (no
italic: an accent phrase turns ember, upright), Figtree for text, labels in sentence
case (the first one an eyebrow in the accent). The date is a rounded sand card:
the date over its facts as rows; weekday and day each stay on one line (`dateWeekday`,
`dateDay`; a payload without them falls back to `dateLong`), so a phone breaks after
the weekday. A mail's title says what it is about: the campaign its subject, a message
to the participants its subject over the evening it belongs to. One action per mail
(the calendar, the registrations for the admin). What you press is round and ember. No shadows, no
bulleted or numbered lists. Webfonts load where the client allows (Apple Mail, iOS),
from `/fonts/mail/` on the site (`src/assets/mail`, stable names, CORS open; the
older Fraunces, DM Sans and Playfair files stay for mails already sent), never from Google: a
third-party font would hand every reader's IP to that party. Elsewhere Georgia and
Helvetica stand in, and Outlook on Windows shows square corners. Every style is inline except the
campaign's `.em-prose` rules for authored content.

Privacy: no `TrackView` pixel and no `TrackLink`; the privacy policy promises no
tracking, and listmonk's global setting that disables view and click tracking
(Settings → Privacy, v6.1+) should stay on as well.
