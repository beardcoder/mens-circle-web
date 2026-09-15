# listmonk transactional templates

The web app sends all event emails through listmonk's **transactional API**
(`POST /api/tx`). Each email type is a **transactional template** maintained in
listmonk; the app only passes a data payload (`{{ .Tx.Data.<field> }}`). This
keeps the markup editable in listmonk and the data/subject logic in the app.

## Diese Dateien sind nicht automatisch live

Anders als die System-Templates unter `listmonk/static/email-templates/` (die
via `--static-dir` im Image mitfahren und darum immer aktuell sind) leben die
Transaktions-Templates in listmonks **Datenbank**. `--static-dir` überlagert
nur die *dateibasierten* System-Templates — eine Änderung hier erreicht kein
einziges Postfach, bis die Vorlage in listmonk ersetzt wird.

Genau so ist der Plakat-Redesign zuerst ins Leere gelaufen: die Dateien waren
neu, die Mails im Posteingang trugen weiter das alte Design.

### Der normale Weg: synchronisieren

```bash
bun run listmonk:sync --dry-run   # zeigt, was sich ändern würde
bun run listmonk:sync             # schreibt
```

Das Skript (`scripts/sync-tx-templates.ts`) schiebt jede Datei aus diesem
Ordner **und** das Kampagnen-Template über die listmonk-API in die Datenbank.
Es ist idempotent — eine Vorlage, deren gespeicherter Body schon zur Datei
passt, wird nicht angefasst — und es ordnet jede Datei in dieser Reihenfolge zu:

1. die ID in ihrer `LISTMONK_TX_*`-Variable,
2. sonst eine vorhandene Vorlage mit gleichem Namen,
3. sonst wird sie neu angelegt und die neue ID ausgegeben.

Zeigt eine Env-Variable auf eine Vorlage vom falschen Typ (eine `tx`-Datei auf
eine `campaign`-Zeile), bricht das Skript für diese Vorlage ab, statt sie zu
überschreiben — sonst nähme ein falsch gesetztes `LISTMONK_TX_*` das
Newsletter-Design mit.

Es braucht `LISTMONK_URL`, `LISTMONK_API_USER` und `LISTMONK_API_TOKEN` (dieselben
Variablen wie der Server) und läuft gegen jede Instanz — lokal wie in Produktion.

**Nach jeder Änderung an einer Datei in diesem Ordner erneut laufen lassen.**

### Der manuelle Weg (listmonk-UI)

Falls kein API-Token zur Hand ist, geht es auch von Hand. Für jede Datei in
diesem Ordner (außer `_layout-snippet.html`):

1. listmonk → **Campaigns → Templates → New** (bzw. die bestehende öffnen).
2. **Type:** `Transactional`.
3. **Name:** etwas Beschreibendes (z. B. „Anmeldebestätigung").
4. **Subject:** `{{ .Tx.Data.subject }}` — die deutsche Betreffzeile baut die
   App und übergibt sie im Daten-Payload.
5. **Body:** den **vollständigen** Inhalt der zugehörigen `*.html` einfügen.
6. Speichern und die numerische **Template-ID** notieren (in der URL / Liste).

### Die Zuordnung

| Datei | Env-Variable | Wofür |
|---|---|---|
| `registration-confirmation.html` | `LISTMONK_TX_REGISTRATION_CONFIRMATION` | Anmeldebestätigung |
| `waitlist-confirmation.html` | `LISTMONK_TX_WAITLIST_CONFIRMATION` | Warteliste-Bestätigung |
| `admin-notification.html` | `LISTMONK_TX_ADMIN_NOTIFICATION` | Admin-Benachrichtigung |
| `waitlist-promotion.html` | `LISTMONK_TX_WAITLIST_PROMOTION` | Nachrücken von der Warteliste |
| `event-reminder.html` | `LISTMONK_TX_EVENT_REMINDER` | Erinnerung (heute/morgen) |
| `event-message.html` | `LISTMONK_TX_EVENT_MESSAGE` | Freie Nachricht an Teilnehmer |

Bleibt eine Template-ID leer, wird die zugehörige E-Mail schlicht übersprungen
(und eine Zeile geloggt) — praktisch, solange man sie einzeln einrichtet.

## The design

Every file is a **complete HTML document** (doctype, head, Google-Fonts link,
one media query), not a body fragment — listmonk sends the template body as the
message, and the head is where the webfonts and the mobile breakpoint have to
live. `_layout-snippet.html` documents the shared skeleton and the palette in
full; the short version is: sand ground, paper sheet, ink masthead and footer
band, a 4px orange rule between them, Barlow Condensed 800 for the poster lines
and Barlow for everything readable, radius 0, and an ink label on every orange
button.

Because the templates are standalone, the skeleton is duplicated across the six
files. Change it in one, change it in all six — `_layout-snippet.html` is the
reference, not an include.

**Each template may only read fields the app actually sends** for that mail.
Go's `html/template` renders a missing field as the literal `<no value>`, so a
field borrowed from a sibling template shows up in the recipient's inbox. The
narrowest payload is `event-message.html` (`subject`, `content`, `eventTitle`,
`siteName`, `recipientEmail`) — it carries no `contactEmail`, which is why its
footer links to the website only. `admin-notification.html` has no `siteName`
either, so it signs off with neither. Check `src/lib/server/email.ts` before
adding a placeholder.

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
> overlays the file-based *system* templates). `bun run listmonk:sync` pushes
> them over the API — see „Diese Dateien sind nicht automatisch live" above.
