# Admin UI and private action contract

Astro owns authentication, server URLs and the private HTML shell. Each management
page mounts one Preact TSX workspace. Native navigation keeps routing simple;
form `beforeunload` guards protect unsaved edits. No global store, persistent
browser storage or polling is used for admin data.

Visual direction: retain the existing dark ground (#151210), warm foreground,
muted text, rust accent and semantic success/danger tokens from theme.css. Use DM
Sans for controls and data, Playfair for page titles and the next evening. Keep
content left aligned, space actions away from destructive tools, and show feedback
at the affected workspace. Native modal dialogs confirm deletion and sending.

| Authenticated action     | Input               | Response                                            |
| ------------------------ | ------------------- | --------------------------------------------------- |
| `loadAdminOverview`      | none                | events, nextEventId, people for the next event      |
| `loadAdminRegistrations` | `{ eventId }`       | eventId, eventTitle, maxParticipants, registrations |
| `loadAdminTestimonials`  | none                | testimonials with moderation fields                 |
| `setEventPublished`      | `{ id, published }` | success message                                     |

All four require the existing signed admin session through `requireAdmin`.
Missing/expired sessions return `UNAUTHORIZED` without private data. Unknown events
return `NOT_FOUND`. Responses use the existing `/_actions/*` private/no-store policy.
Save-event responses now also include the persisted slug: `{ id, slug, message }`.
The other existing delete, status, moderation and mail actions retain their contracts.
Server-side transactional seat allocation and promotion remain authoritative.

After registration changes, confirmations or deletion, the workspace rereads the
protected registration data so seat counts, promotions and confirmation timestamps
stay consistent. A failed refresh is reported separately from a successful mutation;
users are not invited to repeat an already completed send.

Participant/contact fields are delivered only to an authenticated browser, kept in
component memory, and never placed in public caches or localStorage. This change
adds no new data stores, retention periods or recipients. Existing database backups
and soft-delete behavior are unchanged. Rollback is reverting these UI/action changes;
there is no schema migration.
