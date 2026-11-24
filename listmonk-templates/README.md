# Mail templates

listmonk runs outside this repo and keeps only the newsletter now; its campaign template
is versioned here (`campaign-mens-circle.html`). Edit it here, then paste it into listmonk
(Campaigns → Templates).

The participant mails (confirmation, reminder) and the admin's note of a registration
leave the site itself, through EmDash's email pipeline: their HTML is in
`src/lib/server/mail/` (TypeScript functions, one per mail, built from the former
listmonk templates) and their payload in `src/lib/server/mail/index.ts`. The rules
below apply to both.

Colours come from `src/lib/shared/brand.ts` (the `--p-*` primitives of `theme.css` by
name, plus the mail-only footer rule); `tests/brand.test.ts` fails when a template here
or in `src/lib/server/mail/` uses a hex value that is not there. Design as on the site (`docs/design-system.md`), open and full-bleed: three bands
whose grounds run from edge to edge while their content stands on a 600px column.
A dark opening, as on the site: the gold mark (`/images/logo-mail.png`, loaded by
URL; mails already sent still load `/images/logo-flame.png`) and the word mark in
Cormorant, under them the mail's label in the spark and its title at poster size
(50px, 36px on a phone) in bone; then the content on paper, a dark footer that links Impressum and Datenschutz and
carries no slogan. Cormorant 500 for titles and the date, Geist for text,
labels in sentence case. The date stands
open between two rules, the date over its facts as rows; weekday and day each stay
on one line (`dateWeekday`, `dateDay`; a payload without them falls back to
`dateLong`), so a phone breaks after the weekday. No rounded sheet and no card. A
mail's title says what it is about: the campaign its subject, a message to the
participants its subject over the evening it belongs to. One action per mail (the
calendar, the registrations for the admin). What you press is round and gold under a dark label. No
shadows, no bulleted or numbered lists. Webfonts load where the client allows (Apple Mail, iOS),
from `/fonts/mail/` on the site (`src/assets/mail`, stable names, CORS open; the
older Vollkorn, Fraunces, Figtree, DM Sans and Playfair files stay for mails already sent), never from Google: a
third-party font would hand every reader's IP to that party. Elsewhere Georgia and
Helvetica stand in, Every style is inline except the
campaign's `.em-prose` rules for authored content.

Privacy: no `TrackView` pixel and no `TrackLink`; the privacy policy promises no
tracking, and listmonk's global setting that disables view and click tracking
(Settings → Privacy, v6.1+) should stay on as well.
