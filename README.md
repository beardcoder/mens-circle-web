# Männerkreis Niederbayern / Straubing

Schnelle, leichtgewichtige Website für den Männerkreis — **Astro 7 + Svelte 5**,
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
│   ├─ On-Demand-SSR: Startseite (Testimonials) + Event-Seiten                │
│   ├─ Public API  → /api/* (Anmeldung, Newsletter, Testimonial, Events, ICS) │
│   ├─ Admin-UI    → /admin/* (Events anlegen, Anmeldungen verwalten)         │
│   ├─ Datenhaltung → Drizzle ORM auf bun:sqlite (Datei im /data-Volume)      │
│   │    Migrationen werden beim Boot automatisch angewendet (drizzle/)       │
│   └─ Scheduler   → Event-Erinnerungen (alle 15 min, In-Process-Timer)       │
│                                           │                                 │
│                                           ▼ (E-Mail)                         │
│                                        listmonk (externer Dienst)           │
│                                        ├─ Newsletter + Kampagnen            │
│                                        ├─ Pro-Event-Listen                  │
│                                        └─ Transactional API (/api/tx)       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Bun-Server als Edge + Backend.** Ein einziger Bun-Prozess ist der
  öffentliche Einstieg: er liefert die gehashten Assets **und die vorgerenderten
  HTML-Seiten** direkt von Platte, rendert die SSR-Routen on demand und bedient
  die API- und Admin-Routen direkt als Astro-Endpunkte. Es gibt **keinen
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
  von der Warteliste) und Teilnehmer:innen anschreiben. Svelte-5-Islands,
  abgesichert per Middleware ([`src/middleware.ts`](src/middleware.ts)).
- **E-Mail über listmonk.** Sowohl der Newsletter (Double-Opt-In, Kampagnen) als
  auch die **transaktionalen** Event-Mails laufen über listmonk. Die App rendert
  die Mails nicht selbst, sondern ruft listmonks **Transactional API**
  (`POST /api/tx`) mit einer Template-ID + Daten auf; die Templates werden in
  listmonk gepflegt (Quelldateien + Anleitung in
  [`listmonk/tx-templates/`](listmonk/tx-templates/)).
- **RAM-schonend & nachhaltig.** Die meisten Seiten sind vorgerendert (statisch);
  die Startseite und die Event-Seiten rendern serverseitig live, weil sie den
  echten Terminstatus zeigen. Ein Rebuild bei Content-Änderung entfällt — neue
  Events/Testimonials sind sofort sichtbar. (Nebenwirkung: `astro-llms-md`
  verarbeitet nur vorgerenderte Seiten, `/` steht daher nicht mehr in
  `llms.txt`.)
- **Statischer Content** (Texte, FAQ, Hero, Moderator …) liegt als **JSON** im
  Repo (`src/content/`, `src/data/`).
- **Dynamische Teile** (Anmeldung, Warteliste, Newsletter, Testimonial,
  Atemübung) sind **Svelte-5-Islands**, die per `fetch` mit der API sprechen.

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
  nicht umschaltet: oranges Statement, dunkle Bänder (`.section--ink`), Footer,
  Atemübung. Ein Fehler hier fällt im Hellmodus nicht auf und lässt im
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
- **Radius ist überall 0.** `--radius-full` überlebt nur für die Atemübung, wo
  der Kreis das Bedienelement _ist_.

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
  [`src/lib/motion.ts`](src/lib/motion.ts) über Motions `inView` + die Web
  Animations API. Der versteckte Startzustand steht hinter `.motion-ready`, das
  eine Totmannschaltung im Layout wieder abräumt — ohne JS bleibt alles sichtbar.
- **Ambient-Loops** gibt es nur noch in der Atemübung, wo die atmenden Kreise der
  Inhalt sind. [`src/lib/ambient.ts`](src/lib/ambient.ts) pausiert sie, solange
  ihre `<section>` nicht sichtbar ist; `[data-motion-essential]` nimmt sie von
  der Iterationsbremse aus.
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
  components/event/    Server-gerenderte Event-Seite (Hero, Anmeldung, Infos, Karte …)
  components/islands/  Svelte-5-Islands (Formulare, Breathing, Kalender-Modal, Map)
  components/admin/    Svelte-5-Islands der Admin-UI (Events, Anmeldungen, Stimmen)
  layouts/        Layout.astro (Seite), AdminLayout.astro (Back-Office)
  actions/        Astro Actions (`/_actions/*`) — die Admin-RPC-Schicht
  lib/            api.ts (Client-Formulare), motion.ts (Scroll-Reveals),
                  event-status.ts (Terminstatus → Text + Hauptaktion),
                  ambient.ts (Loops der Atemübung parken), site-header.ts,
                  theme.ts, types, umami-config, Utils
  lib/server/     Datenschicht (db/, events, registrations, testimonials,
                  listmonk, email, auth, reminders, ics, format) — NUR serverseitig
  middleware.ts   Admin-Guard + Trailing-Slash-Kanonisierung
  pages/          index, event, atemuebung, teile-deine-erfahrung, [slug], health
  pages/api/      Public-API (Formular-Endpunkte + /api/public/*)
  pages/admin/    Admin-UI-Seiten
  styles/         vollständiges CSS-Designsystem (@layer, light-dark(), kein
                  Tailwind); utilities/_layout.css = .bay + .spine,
                  utilities/_motion.css + base/_keyframes.css = Animation
astro-integrations/  Build-Integrationen (Sitemap/llms.txt in das Static-Manifest
                  des Bun-Adapters nachtragen — s. serve-with-bun-adapter.mjs)
scripts/          reminder-cron.ts (Timer-Scheduler via --preload), send-reminders.ts,
                  backup-db.ts (SQLite → S3)
drizzle/          generierte SQL-Migrationen (beim Boot angewendet)
drizzle.config.ts drizzle-kit-Konfiguration
listmonk/         listmonk-Templates (System, Kampagne) + tx-templates/ (Transactional)
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

1. Neue Ressource → **Dockerfile**-basiert, dieses Repo.
2. **Persistent Volume** mounten auf `/data` (die SQLite-Datenbank).
3. Port **8090** exposen (Bun-Server/Edge). Coolify terminiert TLS.
4. Environment-Variablen setzen (siehe `.env.example`):

| Variable                                                  | Zweck                                              |
| --------------------------------------------------------- | -------------------------------------------------- |
| `APP_URL`                                                 | öffentliche URL (E-Mail-Links, iCal, Bild-URLs)    |
| `DATABASE_PATH`                                           | SQLite-Datei (Default `/data/mens-circle.db`)      |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`                     | Absender transaktionaler Mails                     |
| `MAIL_ADMIN_ADDRESS`, `MAIL_ADMIN_NAME`                   | Empfänger der Admin-Benachrichtigungen             |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                           | Login der Admin-UI (`/admin`)                      |
| `ADMIN_SESSION_SECRET`                                    | langer Zufallswert, signiert das Session-Cookie    |
| `LISTMONK_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN` | listmonk-Admin-API                                 |
| `LISTMONK_LIST_IDS`                                       | numerische Newsletter-Listen-ID(s), z. B. `1`      |
| `LISTMONK_TX_*`                                           | IDs der transaktionalen listmonk-Templates (s. u.) |
| `PUBLIC_SITE_URL`                                         | **Build-Arg**: Canonical/Sitemap                   |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT`                | optional: Umami-Analytics                          |

Die `LISTMONK_TX_*`-IDs verweisen auf die transaktionalen Templates, die einmalig
in listmonk angelegt werden — Anleitung + Quelldateien in
[`listmonk/tx-templates/`](listmonk/tx-templates/README.md).

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

Alle Event-Mails laufen über listmonks **Transactional API**:

| Email                   | Auslöser                           |
| ----------------------- | ---------------------------------- |
| Anmeldebestätigung      | Anmeldung (Status `registered`)    |
| Wartelisten-Bestätigung | Anmeldung bei vollem Event         |
| Admin-Benachrichtigung  | jede Anmeldung                     |
| Wartelisten-Nachrückung | Stornierung → nächste:r rückt nach |
| Event-Erinnerung        | Cron, Event heute/morgen           |
| Teilnehmer-Nachricht    | manueller Versand aus der Admin-UI |

Newsletter (Willkommen/Double-Opt-In + Kampagnen) ebenfalls über listmonk.
Setup der transaktionalen Templates: [`listmonk/tx-templates/README.md`](listmonk/tx-templates/README.md).
