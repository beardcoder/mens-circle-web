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

Design as on the site: night masthead with the brush mark in flame
(`/images/logo-flame.png`, loaded by URL), cream sheet, Fraunces headlines at the
regular weight with one word in rust, the date as flame capitals on night,
Instrument Sans for text, no bulleted or numbered lists. Webfonts load where the
client allows (Apple Mail, iOS); elsewhere Georgia and Helvetica stand in. Every
style is inline except the campaign's `.em-prose` rules for authored content.
