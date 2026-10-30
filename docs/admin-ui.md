# Admin UI and private action contract

Astro owns authentication, server URLs and the private HTML shell. Each management
page mounts one Preact TSX workspace. Native navigation keeps routing simple;
form `beforeunload` guards protect unsaved edits. No global store, persistent
browser storage or polling is used for admin data.

Layout: a dashboard shell (`AdminLayout.astro`) with a sidebar from `lg` and a top
bar plus bottom tab bar below it. `/admin` is the dashboard (key figures, the next
evening, later dates, open tasks); `/admin/events` lists every date with filters;
event, registration and testimonial pages keep their tools beside the work in a
right column. Shared pieces live in `components/admin/ui.tsx` (`PageHeader`, `Stat`,
`Tabs`, `SearchField`, `StatusPill`, `Meter`, `Menu`, `EmptyState`) and the line icons
in `components/admin/icons.tsx`, which AdminLayout also renders statically.

Visual direction: the public design at night — the forest ground, bone text, muted
moss, the ember accent and the semantic success/danger tokens from theme.css. Figtree
for controls and data, Fraunces for page titles and the next evening. Controls are
round, cards rounded (`rounded-xl`). Space actions away from destructive tools, and show feedback at the
affected workspace. Native modal dialogs confirm deletion and sending.

The pages themselves are guarded by `src/middleware.ts`: without a valid signed
session every `/admin` route except `/admin/login` redirects to the login with a
`redirect` back, before any private data is read; the pages and actions are
`private, no-store`. Signing out is a plain form post to `/auth/logout` (no island),
which deletes the session cookie and redirects to `/admin/login`.

| Authenticated action     | Input               | Response                                            |
| ------------------------ | ------------------- | --------------------------------------------------- |
| `loadAdminOverview`      | none                | events, nextEventId, people, pendingTestimonials    |
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
