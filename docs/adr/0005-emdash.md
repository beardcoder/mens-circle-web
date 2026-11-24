# 0005: EmDash instead of the custom back office

**Status:** accepted (2026-11). Replaces the Drizzle schema, the Preact admin and the
Pocket ID sign-in; 0003 holds for EmDash's SQLite file, 0004 for its cancel link.

**Context.** The site carried its own back office: a Drizzle schema, Preact
workspaces for events, registrations and voices, a Pocket ID sign-in, listmonk
transactional templates and a host-driven scheduler. Every change to the content model
meant schema, migration, admin form and action.

**Decision.** [EmDash](https://github.com/emdash-cms/emdash) runs inside the Astro
build. Events, registrations and voices are its collections (`seed/seed.json`); its
admin, passkey sign-in, drafts, revisions, trash and cache purge are used as they come.
What collections cannot do alone lives in one native plugin (`src/plugin`): public
sign-ups through its public routes, the seat limit, the participant mails through
EmDash's email pipeline, the cancel link, the reminder pass and the deletion, the last
two on the plugin's in-process cron. The public forms keep their Astro Actions, which
call the plugin (EmDash gives anonymous requests no other way to write).

**Given up.** The waiting list (a full evening takes no sign-ups), messages to all
participants and the event newsletter from the admin (write them in listmonk), the
curated order of voices (newest first), voices' addresses, the participant record
across events, the admin's note and the attendance CSV, the S3 backup (Coolify's volume
backups instead). The seat check and the insert are two steps, so two sign-ups in the
same instant can overbook by one (`shortcut:` in `registration.ts`).

**Revisit when** overbooking happens (a per-event counter with `updateIf`), the waiting
list is missed, or EmDash's plugin API gains reference fields and permanent deletes.
