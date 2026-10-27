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
wraps the body built by `buildEventNewsletterHtml` in `src/lib/server/events.ts` and
adds the greeting, signature, footer and unsubscribe link.

Design as on the site (`docs/design-system.md`): a masthead on the dark focus ground
with the mark in the light text colour (`/images/logo-mail.png`, loaded by URL; mails
already sent still load `/images/logo-flame.png`) and the wordmark as in the site
header (DM Sans, medium, tracked in), paper sheet, Playfair Display at the
regular weight for titles and the date, titles in one colour (the italic accent only
in the campaign's statement and breath line), DM Sans for text, labels as small
spaced capitals without ornaments. The date is the site's summary card: flat, square,
a thin line, the date over its facts as rows. What you press is round (the calendar
and registration actions); everything that holds content is square. No shadows, no
bulleted or numbered lists. The footer is compact on the dark ground and carries no
slogan; it links Impressum and Datenschutz. Webfonts load where the client allows
(Apple Mail, iOS), from `public/fonts/mail/` on the site (stable names, CORS open),
never from Google: a third-party font would hand every reader's IP to that party.
Elsewhere Georgia and Helvetica stand in, and Outlook on Windows shows square
buttons. Every style is inline except the campaign's `.em-prose` rules for authored
content.

Privacy: no `TrackView` pixel and no `TrackLink`; the privacy policy promises no
tracking, and listmonk's global setting that disables view and click tracking
(Settings → Privacy, v6.1+) should stay on as well.
