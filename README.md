# Männerkreis Niederbayern / Straubing

Schnelle, leichtgewichtige Website für den Männerkreis — **Astro 7** (ohne UI-Framework),
**SSR in der Bun-Runtime**, **Drizzle ORM auf `bun:sqlite`** als Backend. Der
Bun-Server ist selbst der öffentliche Edge (kein nginx) **und** das Backend in
einem Prozess. Alles zusammen in **einem** Docker-Image, deploybar mit Coolify.
Paketmanager, Build-Tool **und** Laufzeit ist **Bun**.

## Architektur

```
┌─────────────────────────── ein Docker-Container ───────────────────────────┐
│                                                                             │
│   Astro-Server (Bun, Edge + Backend, :8090 — der nach außen exposte Port)   │
│   ├─ liefert statische Assets + vorgerenderte HTML direkt → /app/dist/client│
│   │    (gehashte Assets immutable, Security-Header)                         │
│   ├─ On-Demand-SSR: Server Islands + Event-Seiten                │
│   ├─ Actions     → /_actions/* (Formulare + Admin), ICS für Bestätigungsmails│
│   ├─ Admin-UI    → /admin/* (Events anlegen, Anmeldungen verwalten)         │
│   ├─ Datenhaltung → Drizzle ORM auf bun:sqlite (Datei im /data-Volume)      │
│   │    Migrationen werden beim Boot automatisch angewendet (drizzle/)       │
│   └─ Scheduler   → Event-Erinnerungen (alle 15 min, In-Process-Timer)       │
└─────────────────────────────────────────────────────────────────────────────┘
                         │ HTTPS / LISTMONK_URL
                         ▼
              listmonk (extern verwaltet, nicht Teil dieses Deployments)
              ├─ Newsletter + Kampagnen
              ├─ Pro-Event-Listen
              └─ Transactional API (/api/tx) → SMTP
```

- **Bun-Server als Edge + Backend.** Ein einziger Bun-Prozess ist der
  öffentliche Einstieg: er liefert die gehashten Assets **und die vorgerenderten
  HTML-Seiten** direkt von Platte, rendert die SSR-Routen on demand und bedient
  Formulare und Admin-Aktionen als Astro Actions. Es gibt **keinen
  separaten Backend-Prozess** mehr — die Daten liegen in einer SQLite-Datei, auf
  die Drizzle in-process zugreift. Den Server-Entrypoint
  (`dist/server/entry.mjs`) erzeugt `@wyattjoh/astro-bun-adapter` beim Build; es
  gibt keine handgeschriebene Server-Datei. Kompression + TLS übernimmt der
  Coolify-Edge. Liveness-Probe: `GET /health`
  ([`src/pages/health.ts`](src/pages/health.ts)).
- **Datenhaltung: Drizzle + bun:sqlite.** Schema in
  [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts), Migrationen unter
  [`drizzle/`](drizzle/) (mit `bun run db:generate` aus dem Schema erzeugt) werden
  beim Server-Boot automatisch angewendet
  ([`src/lib/server/db/index.ts`](src/lib/server/db/index.ts)).
- **Native Admin-UI.** Unter `/admin` (Login per `ADMIN_EMAIL`/`ADMIN_PASSWORD`,
  signiertes Session-Cookie) lassen sich Veranstaltungen anlegen/bearbeiten,
  Anmeldungen verwalten (Status ändern, stornieren → automatisches Nachrücken
  von der Warteliste) und Teilnehmer:innen anschreiben. Astro-Seiten mit
  kleinen Skripten, abgesichert per Middleware ([`src/middleware.ts`](src/middleware.ts)).
- **E-Mail über listmonk.** Sowohl der Newsletter (Double-Opt-In, Kampagnen) als
  auch die **transaktionalen** Event-Mails laufen über listmonk. Die App rendert
  die Mails nicht selbst, sondern ruft listmonks **Transactional API**
  (`POST /api/tx`) mit einer Template-ID + Daten auf; die Templates werden in
  der externen Instanz gepflegt. Dieses Repo enthält nur die Integration,
  keine listmonk-Images, Dienste, Assets oder Vorlagen. Einrichtung und
  Payload-Vertrag stehen unter [E-Mails](#e-mails).
- **Statische Startseite mit nativen Server Islands.** Astro rendert die Seite
  und ihre Bilder beim Build. Termine, Fakten und Stimmen laden über
  `server:defer` live nach. Event-Seiten bleiben vollständig SSR. Neue Events
  und freigegebene Stimmen benötigen keinen Rebuild. Ohne JavaScript verweist
  die Startseite auf die weiterhin serverseitig gerenderte Terminseite.
- **Statischer Content** (Texte, FAQ, Hero, Moderator …) liegt als **JSON** im
  Repo (`src/content/`, `src/data/`).
- **Formulare** (Anmeldung, Newsletter, Testimonial) sind normale HTML-Formulare
  ([`src/components/forms/`](src/components/forms/)), die ihr `FormData` an
  **Astro Actions** ([`src/actions/`](src/actions/)) schicken. Die
  Feldvalidierung steht nur im Zod-Schema der Action; Fehler landen über
  `isInputError(error).fields` direkt neben dem Feld
  ([`src/lib/form.ts`](src/lib/form.ts)).

## Gestaltung

Die Seite ist als **Plakat** gebaut, nicht als Theme: drei Farben, eine
Schriftfamilie in zwei Schnitten, ein grafisches Motiv.

- **Typografie in zwei Registern**, die sich bewusst nicht überschneiden.
  **Barlow Condensed 800** für das Plakat-Register (`.display`, bis 180px,
  Versalien, `line-height: .85`), **Barlow** für alles Lesbare (17–60px).
  Dazwischen liegt nichts — der Sprung _ist_ die Hierarchie. Gegengewicht ist
  der kleine Marker (`.marker`): dieselbe schmale Schrift in der kleinsten
  Größe der Seite.
- **Farben:** Haferpapier `#F2EDE3`, Rindentinte `#1C1714`, gebranntes Orange
  `#DD5F33`. Jeder Ton liegt auf der warmen Seite von Neutral — das unterscheidet
  die Palette von einer Produktpalette, deshalb sind auch die Grautöne ocker-
  statt blaustichig. Wo welche Farbe stehen darf, entscheiden die gemessenen
  Kontraste: Orange auf Papier ist 3,1:1 und deshalb **Fläche, Strich und große
  Schrift** (die Schrittziffern), nie kleine Schrift; Weiß auf Orange ist 3,6:1
  und reicht für Fließtext nicht, deshalb sind Buttons **Tinte auf Orange**
  (4,9:1); auf dem dunklen Grund trägt das Orange auch als Schriftfarbe (4,9:1).
- **Drei Gründe, nicht zwei.** `.section--sand` (`--bg-secondary`) ist die ruhige
  Mitte zwischen Papier und dunklen Bändern — der Markus-Block und die Stimmen
  stehen darauf. Wie jeder Grund schaltet er mit dem Modus um.
- **Alles auf dem Seitengrund muss mit dem Modus umschalten** —
  `--text-primary`, `--text-muted`, `--rule-strong`, `--bg-*`. Die literalen
  `--color-ink` / `--color-paper` sind nur dort richtig, wo der Grund selbst
  nicht umschaltet: oranges Statement, dunkle Bänder (`.section--ink`), Footer.
  Ein Fehler hier fällt im Hellmodus nicht auf und lässt im
  Dunkelmodus Text verschwinden.
- **Zwei Rastersysteme.** `.bay` ist ein 12-Spalten-Raster (1320px); die
  Abschnitte liegen in _verschiedenen_ Spalten, damit die linke Kante wandert.
  `.spine` (Markerspalte + Textspalte) bleibt den ruhigen Passagen und
  Unterseiten vorbehalten — es überall zu benutzen war der Grund, warum eine
  frühere Fassung wie ein Standard-Theme wirkte.
- **Der Kreis** ([`src/components/Ring.astro`](src/components/Ring.astro)) ist
  das einzige grafische Motiv: ein dicker, offener oranger SVG-Ring, genau
  zweimal eingesetzt (Hero, Abschluss), am Bildschirmrand angeschnitten, nie
  über Text oder Bedienelementen.
- **Radius ist überall 0.**

## Motion & Seitenübergänge

Drei gestaltete Bewegungssituationen, sonst nichts. Alles CSS-first, nur
`opacity`/`transform`, alles hinter `prefers-reduced-motion: no-preference` —
und jede Animation endet in dem Zustand, den ein statischer Render ohnehin
zeigt.

1. **Einstieg** — die Hero-Überschrift kommt zeilenweise, Ring und Bildfläche
   leicht versetzt, zusammen ~820ms.
2. **Der Ring auf Scroll** — Drift und leichte Drehung über eine
   `view()`-Timeline, begrenzt auf ±20px und ±6°. Kein Listener, kein
   Scroll-Hijacking.
3. **Das Statement** — die drei Zeilen im orangen Feld rücken beim Eintritt
   flush-links ein.

- **Regeln** in [`src/styles/utilities/_motion.css`](src/styles/utilities/_motion.css),
  **Keyframes** ungelayert in
  [`src/styles/base/_keyframes.css`](src/styles/base/_keyframes.css).
- **Scroll-Reveals** (nur noch an wenigen Stellen) treibt
  [`src/lib/motion.ts`](src/lib/motion.ts) über einen IntersectionObserver +
  die Web Animations API (keine Bibliothek). Der versteckte Startzustand steht hinter `.motion-ready`, das
  eine Totmannschaltung im Layout wieder abräumt — ohne JS bleibt alles sichtbar.
- **Seitenübergänge** sind native Cross-Document View Transitions
  ([`src/styles/utilities/_view-transitions.css`](src/styles/utilities/_view-transitions.css)),
  kein Router. Ein `pagereveal`-Listener im Layout setzt `.vt-arrival` vor dem
  ersten Paint, damit die ankommende Seite ihre eigene Entrance auslässt und nur
  der Cross-Fade läuft.

Vier Fallen, die hier schon zugeschnappt sind:

1. **Keine Layout-Eigenschaften animieren.** Der Header hat `padding-block` auf
   einer Scroll-Timeline animiert — das lief nicht auf dem Compositor, sondern
   rechnete den fixierten Header in jedem Scroll-Frame neu um.
2. **Kein `filter: blur()` auf eng gesetzter Display-Schrift.** Ein Filter malt
   durch eine Region, die aus der Border-Box abgeleitet wird; bei
   `line-height: 0.88` ragen die Glyphen darüber hinaus und WebKit schneidet ab.
3. **Ein Element, eine `animation`-Kurzschreibweise.** Einstieg und Scroll-Drift
   des Rings animieren beide `transform`. Solange sie auf demselben Element
   lagen, hat die `.vt-arrival`-Regel (`animation: none`, die den Einstieg nach
   einem Seitenwechsel stilllegt) die Drift stillschweigend mit abgeschaltet.
   Jetzt trägt ein Wrapper den Einstieg und das innere `<svg>` die Drift.
4. **Deutsche Display-Schrift ragt aus ihrer Zeilenbox.** Bei `line-height: .85`
   sitzt der Umlaut auf dem `Ä` über der Versalhöhe und kollidiert mit dem, was
   darüber steht; `.display` reserviert diesen Überstand mit
   `padding-block-start: .14em`.

Beim Cross-Fade gilt zusätzlich: `mix-blend-mode: plus-lighter` stimmt nur,
solange beide Hälften dieselbe **lineare** Kurve und dieselbe Dauer
(`--vt-duration`) haben — eine gestaffelte Kurve summiert sich über 1 und blitzt
hell auf.

## Projektstruktur

```
src/
  content/        home.json (Block-Reihenfolge + Texte), legal/*.json
  data/           site.json, navigation.json
  components/      Astro-Blöcke (Hero, Facts, Intro, Statement, FAQ …),
                  Ring.astro (das Kreismotiv), Header, Footer, SEO
  components/event/    Server-gerenderte Event-Seite (Hero, Anmeldung, Infos,
                       Kalender-Popover mit eingebettetem .ics, Karte …)
  components/forms/    Anmeldung, Newsletter, Testimonial (HTML + Action)
  components/admin/    Admin-UI (Events, Anmeldungen, Stimmen)
  layouts/        Layout.astro (Seite), AdminLayout.astro (Back-Office)
  actions/        Astro Actions (`/_actions/*`), nach Bereich aufgeteilt:
                  forms, auth, events, registrations, testimonials
  lib/            form.ts (Formulare → Actions), motion.ts (Scroll-Reveals),
                  event-status.ts (Terminstatus → Text + Hauptaktion),
                  event-meta.ts / event-schema.ts (Share-Metadaten, JSON-LD),
                  site-header.ts, theme.ts, toast.ts, types
  lib/server/     Datenschicht (db/, events, registrations, testimonials,
                  listmonk, email, auth, reminders, ics, format) — NUR serverseitig
  middleware.ts   Admin-Guard + Trailing-Slash-Kanonisierung
  pages/          index, event, event/[slug], teile-deine-erfahrung, [slug], health
  pages/api/      nur noch /api/public/events/<slug>/ics (Link in Bestätigungsmails)
  pages/admin/    Admin-UI-Seiten
  styles/         vollständiges CSS-Designsystem (@layer, light-dark(), kein
                  Tailwind); utilities/_layout.css = .bay + .spine,
                  utilities/_motion.css + base/_keyframes.css = Animation
astro-integrations/  publish-generated-files.mjs: Sitemap-Index und llms.txt um
                  SSR-Seiten ergänzen und ins Static-Manifest des Bun-Adapters
                  eintragen
scripts/          schedule.ts (ein Cron-Entrypoint für alle wiederkehrenden
                  Aufgaben, von Coolifys "Scheduled Task" per Host-Cron
                  aufgerufen — siehe Deployment-Abschnitt), lib/cron.ts
                  (Cron-Matcher), send-reminders.ts, backup-db.ts (SQLite → S3)
drizzle/          generierte SQL-Migrationen (beim Boot angewendet)
drizzle.config.ts drizzle-kit-Konfiguration
Dockerfile        Multi-Stage: Bun-Build → Bun-Runtime (ein Prozess)
```

## Lokale Entwicklung

Voraussetzungen: [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install
cp .env.example .env   # ADMIN_EMAIL / ADMIN_PASSWORD setzen für /admin

bun run dev            # Astro-Dev-Server (Port 4321), API + Admin inklusive
```

Das `dev`-Skript ist `bun --bun astro dev`: die Bun-Runtime ist zwingend, sonst
brechen die DB-Seiten an `bun:sqlite`. Kein zweites `--bun` davorsetzen. Der
Astro-7-Dev-Server läuft als Daemon im Hintergrund — `bun run dev` kehrt sofort
zurück, gesteuert wird er über `bunx astro dev status | logs | stop`.

Die SQLite-Datei wird automatisch unter `./data/mens-circle.db` angelegt und beim
Start migriert. Nach Schema-Änderungen neue Migration erzeugen:

```bash
bun run db:generate    # erzeugt drizzle/<n>_*.sql aus dem Schema
bun run db:studio      # optional: Drizzle Studio (DB-Browser)
```

### Build & lokal ausführen

```bash
bun run build          # → dist/   (NICHT `bun --bun run build`, das bricht Rollup)

# Den gebauten Server in der Bun-Runtime starten (wie in Produktion):
PORT=3000 DATABASE_PATH=./data/mens-circle.db \
  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret \
  bun run start
```

## Deployment mit Coolify

Das Runtime-Image enthält nur Produktionsabhängigkeiten. Lokale Datenbanken,
Screenshots und Testdateien bleiben außerhalb des Docker-Build-Kontexts;
Migrationen aus `drizzle/` werden weiterhin mitgeliefert.
Deployt wird ausschließlich die Web-App; listmonk samt PostgreSQL, Uploads,
SMTP und Vorlagen wird unabhängig davon extern betrieben und gesichert.

1. Neue Ressource → **Dockerfile**-basiert, dieses Repo.
2. **Persistent Volume** mounten auf `/data` (die SQLite-Datenbank).
3. Port **8090** exposen (Bun-Server/Edge). Coolify terminiert TLS.
4. Environment-Variablen setzen (siehe `.env.example`):

| Variable                                   | Zweck                                                           |
| ------------------------------------------ | --------------------------------------------------------------- |
| `APP_URL`                                  | öffentliche URL (E-Mail-Links, iCal, Bild-URLs)                 |
| `DATABASE_PATH`                            | SQLite-Datei (Default `/data/mens-circle.db`)                   |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`      | Absender transaktionaler Mails                                  |
| `MAIL_ADMIN_ADDRESS`, `MAIL_ADMIN_NAME`    | Empfänger der Admin-Benachrichtigungen                          |
| `MAIL_CONTACT_ADDRESS`, `SITE_NAME`        | Kontaktadresse und Name im Transaktions-Payload                 |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`            | Login der Admin-UI (`/admin`)                                   |
| `ADMIN_SESSION_SECRET`                     | langer Zufallswert, signiert das Session-Cookie                 |
| `LISTMONK_URL`                             | externe Basisadresse ohne `/api`-Suffix, HTTPS empfohlen        |
| `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`  | API-Benutzer und Token der externen Instanz                     |
| `LISTMONK_LIST_IDS`                        | numerische Newsletter-Listen-IDs, kommasepariert, keine UUIDs   |
| `LISTMONK_CAMPAIGN_TEMPLATE_ID`            | optionale numerische Kampagnen-Template-ID der externen Instanz |
| `LISTMONK_TX_*`                            | sechs numerische Transaktions-Template-IDs (siehe E-Mails)      |
| `PUBLIC_SITE_URL`                          | **Build-Arg**: Canonical/Sitemap                                |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT` | optional: Umami-Analytics                                       |

`LISTMONK_URL` muss aus dem Web-Container erreichbar sein; die App ergänzt die
API-Pfade selbst und entfernt abschließende Slashes. Zugangsdaten nur als
Runtime-Secrets hinterlegen. Nach Änderungen an URL, Zugangsdaten oder IDs die
Web-App neu starten. Die App richtet den externen Dienst nicht ein; siehe
[Externe Instanz einrichten](#externe-instanz-einrichten).

5. **Scheduled Task** anlegen für die Erinnerungsmails (und, wenn `BACKUP_S3_*`
   gesetzt ist, das SQLite-Backup): Command `bun run scripts/schedule.ts`,
   Cron-Ausdruck `* * * * *` (jede Minute; ist die Granularität in der Coolify-UI
   feiner als `*/5 * * * *` nicht verfügbar, reicht `*/5 * * * *` ebenfalls — die
   eigentliche Kadenz jeder Aufgabe steht in `scripts/schedule.ts` selbst, siehe
   CLAUDE.md-Abschnitt "Cron"). Der Host-Cron entscheidet nur, wie oft
   nachgeschaut wird; `schedule.ts` führt pro Aufruf nur die gerade fälligen
   Aufgaben aus. War hier zuvor bereits ein separater Scheduled Task allein für
   `bun run scripts/backup-db.ts` eingerichtet, diesen entfernen — sonst läuft
   das Backup doppelt, einmal direkt und einmal über `schedule.ts`.

Alternativ als **Docker-Compose**-Ressource mit `docker-compose.yml` deployen:
Die Datei enthält nur `web` und das SQLite-Volume `app-data`. Coolify setzt
`SERVICE_URL_WEB` für Build- und App-URL; `LISTMONK_URL` explizit als
Environment-Variable der Ressource setzen. Sie wird unverändert an den
Web-Container weitergegeben; es gibt keine lokale listmonk-Startabhängigkeit.

### Migration einer bisherigen listmonk-Instanz

**Vor dem Abschalten oder Entfernen alter Dienste/Volumes:** listmonks
PostgreSQL-Datenbank, Uploads, System-/Kampagnen-/Transaktionsvorlagen und
Appearance-Anpassungen sichern und extern übernehmen; auch die SQLite-Datenbank
der Web-App sichern. Eine vollständige Datenbankübernahme ist einer leeren
Neuinstallation vorzuziehen, damit Abonnenten, Opt-in-Status und IDs erhalten
bleiben.

Alle vorhandenen Listen- und Template-IDs müssen auf der Zielinstanz weiterhin
dieselben Objekte bezeichnen: `LISTMONK_LIST_IDS`, `LISTMONK_CAMPAIGN_TEMPLATE_ID`,
alle sechs `LISTMONK_TX_*` und besonders **`events.listmonk_list_id` in SQLite**.
Nur die URL umzuschalten reicht bei einer leeren Zielinstanz nicht; andernfalls
können IDs fehlen oder auf fremde Listen/Vorlagen zeigen. Abweichende IDs vor der
Umschaltung kontrolliert zuordnen und migrieren, nicht blind wiederverwenden.

SMTP, öffentliche Opt-in-/Abmeldelinks und Vorlagen der Zielinstanz vor der
Stilllegung prüfen; Versandtests nur mit freigegebenen Testempfängern durchführen.
Die Repository-Bereinigung migriert keine Live-Daten und löscht keine laufenden
Dienste oder Volumes. Alte Volumes erst nach verifiziertem Backup und erfolgreicher
Übernahme ausdrücklich freigeben — keine pauschale Volume-Löschung beim Redeploy.

## Content pflegen

- **Startseiten-Texte / Block-Reihenfolge:** `src/content/home.json`
- **Globale Einstellungen** (Name, Social-Links, WhatsApp-Link, Footer): `src/data/site.json`
- **Navigation:** `src/data/navigation.json`
- **Impressum / Datenschutz:** `src/content/legal/*.json`
- **Events, Anmeldungen, Stimmen:** in der **Admin-UI** unter `/admin`.
- **Newsletter (Abonnenten + Kampagnen):** im listmonk-Admin der externen Instanz.

**Events und Testimonials** werden serverseitig (SSR) live aus der Datenbank
gerendert — eine Änderung in der Admin-UI ist **sofort** sichtbar, ohne Rebuild.

## E-Mails

### Externe Instanz einrichten

1. In listmonk SMTP, erlaubten Absender und die öffentliche Basisadresse für
   Opt-in-, Abmelde- und Browserlinks konfigurieren. Systemvorlagen und Public-Page-
   Branding dort verwalten; sie werden nicht mehr mit dieser App ausgeliefert.
2. Newsletter-Listen mit **Double-Opt-In** anlegen und deren numerische IDs als
   `LISTMONK_LIST_IDS` setzen. Die App meldet Newsletter-Abonnenten unbestätigt an.
3. Einen API-Benutzer mit den benötigten Rechten für Abonnenten, Listen, Kampagnen
   und Transaktionsversand einrichten. `LISTMONK_URL`, `LISTMONK_API_USER` und
   `LISTMONK_API_TOKEN` in der Web-App setzen. Die Authentifizierung verwendet
   `Authorization: token <API_USER>:<API_TOKEN>`.
4. Eine Kampagnenvorlage extern pflegen: im Body genau einmal
   `{{ template "content" . }}` und einen Abmeldelink (`{{ UnsubscribeURL }}`)
   vorsehen. Optional ihre ID als `LISTMONK_CAMPAIGN_TEMPLATE_ID` setzen; ohne ID
   übergibt die App keine explizite Vorlage an listmonk.
5. Unter **Campaigns → Templates → New** die folgenden sechs Vorlagen vom Typ
   **Transactional** anlegen bzw. übernehmen. Jeweils den Betreff auf
   **`{{ .Tx.Data.subject }}`** setzen, ein vollständiges HTML-Dokument als Body
   hinterlegen und die numerische ID der Web-App zuweisen. Diese Vorlagen leben
   in listmonks Datenbank; sie werden nicht durch einen Dateisystem-Overlay angelegt.

| Environment-Variable                    | Mail / Auslöser                            |
| --------------------------------------- | ------------------------------------------ |
| `LISTMONK_TX_REGISTRATION_CONFIRMATION` | Anmeldebestätigung (`registered`)          |
| `LISTMONK_TX_WAITLIST_CONFIRMATION`     | Wartelisten-Bestätigung bei vollem Event   |
| `LISTMONK_TX_ADMIN_NOTIFICATION`        | Admin-Benachrichtigung bei jeder Anmeldung |
| `LISTMONK_TX_WAITLIST_PROMOTION`        | Stornierung → nächste:r rückt nach         |
| `LISTMONK_TX_EVENT_REMINDER`            | Cron, Event heute/morgen                   |
| `LISTMONK_TX_EVENT_MESSAGE`             | Teilnehmer-Nachricht aus der Admin-UI      |

Fehlt eine Transaktions-Template-ID, wird die entsprechende Mail übersprungen
und protokolliert. Ohne API-Konfiguration funktionieren E-Mail-Versand und
Listen-Synchronisierung nicht; Newsletter benötigt zusätzlich `LISTMONK_LIST_IDS`.

**Event-Listen bleiben Teil der Integration.** Die App erzeugt private
Single-Opt-In-Listen pro Veranstaltung, speichert deren IDs in
`events.listmonk_list_id` und synchronisiert Anmeldung/Stornierung. Diese IDs
sind unabhängig von `LISTMONK_LIST_IDS` (nur Newsletter); dafür sind keine
zusätzlichen Env-Variablen nötig.

### Transaktions-Payload-Vertrag

Maßgeblich sind [`src/lib/server/email.ts`](src/lib/server/email.ts) und
[`src/lib/server/listmonk.ts`](src/lib/server/listmonk.ts). Die App stellt zunächst
sicher, dass der Empfänger als Abonnent existiert, und sendet dann
`{ subscriber_id, template_id, data, content_type: "html", from_email }` an
`POST /api/tx`. Platzhalter greifen auf `{{ .Tx.Data.<field> }}` zu.

Alle sechs Payloads enthalten `subject` und `eventTitle`. Für **Bestätigung,
Warteliste, Nachrücken und Erinnerung** kommen gemeinsam hinzu:
`firstName`, `recipientEmail`, `siteName`, `contactEmail`, `dateLong`, `dateShort`,
`timeRange`, `location`, `address`, `locationDetails`.

- **Bestätigung und Nachrücken:** zusätzlich `description`, `costBasis`, `icsUrl`;
  `address` enthält die vollständige Adresse. `icsUrl` basiert auf `APP_URL`.
- **Warteliste:** nur die gemeinsamen Felder; `address` ist leer.
- **Erinnerung:** zusätzlich `description`, `costBasis`, `whenWord` (`heute`/`morgen`),
  `whenWordCap` (`Heute`/`Morgen`), `closingWord` (`gleich`/`morgen`); `address` ist leer,
  kein `icsUrl`.
- **Admin-Benachrichtigung:** neben `subject`/`eventTitle` ausschließlich
  `participantName`, `participantEmail`, `participantPhone`, `dateShort`,
  `timeRange`, `location`, `activeCount`, `maxParticipants`, `statusLabel`
  (`Warteliste`/`Angemeldet`). Kein `siteName` oder Teilnehmer-Kontext.
- **Teilnehmer-Nachricht:** neben `subject`/`eventTitle` ausschließlich `content`,
  `siteName`, `recipientEmail`. Die App ersetzt `{first_name}` bereits in `content`;
  kein `firstName` oder `contactEmail` im Payload.

Vorlagen dürfen nur die für ihren Typ gelieferten Felder lesen und müssen leere
Werte berücksichtigen. Go-HTML-Template-Escaping beibehalten; mehrzeiligen Klartext
(`description`, `locationDetails`, `content`) etwa mit `white-space: pre-line`
darstellen, nicht als ungeprüftes HTML. Layout und Texte werden ausschließlich
auf der externen Instanz gepflegt.

## Performance & Regressionstests

- `bun run test` prüft die Performance-Regressionen mit temporären Datenbanken und
  simuliertem HTTP; echte Empfänger werden nicht angeschrieben.
- `bun run check`, `bun run lint` und `bun run build` prüfen Typen, Stil und
  Produktionsbuild. Beim Build weiterhin **kein zusätzliches `--bun`** verwenden.
- Öffentliche Event-Daten inklusive Platzanzahl werden in einer SQL-Abfrage
  gelesen. Terminstatus und freie Plätze bleiben pro Request aktuell; es gibt
  keinen gemeinsamen HTML-Cache für diese Seiten.
- Erinnerungen und Teilnehmer-Nachrichten nutzen je Aufruf höchstens vier
  parallele Empfänger-Workflows. Nur von listmonk akzeptierte Erinnerungen
  erhalten einen Versandstempel. Das ist keine dauerhafte Queue und keine
  Exactly-once-Garantie bei Prozessabbrüchen.
- Prefetch ist auf ausgewählte statische Links bei Hover beschränkt. Der
  Service Worker verwendet gehashte Assets direkt aus dem Cache und speichert
  nur die App-Navigation für Offline-Nutzung, keine Live-Terminseiten.

ISR ist deaktiviert; alle Bilder sind fertige statische Dateien. Kompression muss am
Coolify-Proxy geprüft werden; der Bun-Adapter komprimiert Antworten nicht selbst.

## Bilder: Astro-Bordmittel, keine Runtime-Verarbeitung

Die Startseite ist vorgerendert; Live-Termine und Stimmen laden über Astros
native Server Islands (`server:defer`). Event-Seiten, API und Admin bleiben SSR.
Die vorhandenen `<Picture>`-Elemente aus `astro:assets` erzeugen beim regulären
`bun run build` AVIF-, WebP- und JPEG-Dateien unter `dist/client/assets/`.
`srcset`, `sizes`, Abmessungen, Ladeprioritäten und Bildausschnitte bleiben
bei den Bildkomponenten. Es gibt keine eigene Bildpipeline und kein Bildmanifest.
Die Startseite setzt `Cache-Control: no-cache`, damit nach einem Deployment
die verschlüsselten Server-Island-Parameter zum aktuellen Build passen.

Alle Events verwenden `/images/og-default.png` (1200×630), auch direkt nach dem
Anlegen. Datum und Platzstatus bleiben in den Live-Texten und Metadaten.
Die alte Route `/event/<slug>/card.png` ist gelöscht und liefert 404.
Zusätzliche Admin-Bild-URLs im JSON-LD bleiben direkte Original-URLs; dort nur
fertige statische Bilddateien hinterlegen, keine On-Demand-Bilddienste. Neue
Repo-Fotos werden durch einen Rebuild verfügbar. Ein CMS-Export ist nicht nötig.

Astro registriert `/_image` bei SSR-Builds automatisch. Der minimale
Endpoint-Override liefert deshalb nur 404 ohne Quellabruf oder Transformation,
auch bei veränderten Parametern. Die Konfiguration darf nicht einfach entfallen,
sonst aktiviert Astro wieder seinen Runtime-Transformer. Astros CSRF-Schutz kann fremde
POST-Anfragen vorher mit 403 abweisen. Satori, der OG-Renderer und dessen lokale
Fontkopien sind entfernt. Sharp ist ausschließlich Build-/Test-Abhängigkeit,
bei Vite extern und im Docker-Runtime-Layer nicht installiert. Astro kann seinen
ungenutzten Image-Service-Wrapper mitliefern; Sharp/libvips werden dadurch weder
mitgeliefert noch geladen. ISR ist deaktiviert.

```bash
bun run build
# Gebauten Server starten, dann in einem zweiten Terminal:
bun run images:verify http://127.0.0.1:8090 optionaler-event-slug
```

Der separate Prüfer decodiert die von den Seiten referenzierten Bilddateien,
prüft die nativen Server Islands und testet frühere Bildendpunkte direkt.
Sharp läuft nur in diesem Prüfprozess. Das Produktionsimage enthält ihn nicht.

Eine RAM-Reduktion durch entfallene Renderer/Caches wird erwartet; eine belastbare
Vorher/Nachher-Messung liegt nicht vor. Für Rollback das vorherige Container-Image
mit seinen zugehörigen Assets verwenden. Die SQLite-Daten bleiben unverändert.
