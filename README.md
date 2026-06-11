# Männerkreis Niederbayern / Straubing

Schnelle, leichtgewichtige Website für den Männerkreis — **Astro 5/6 + Svelte 5** im
Frontend, **PocketBase** als Backend. Beides zusammen in **einem** Docker-Image,
deploybar mit Coolify. Paketmanager & Build-Tool ist **Bun**.

## Architektur

```
┌─────────────────────────── ein Docker-Container ───────────────────────────┐
│                                                                             │
│   PocketBase (ein Go-Binary, winziger RAM-Footprint)                        │
│   ├─ serviert die statische Astro-Site            → pb_public/ (dist)       │
│   ├─ REST API + Admin-UI (/_/)                                              │
│   ├─ Custom-Routen (Anmeldung, Newsletter, …)     → pb_hooks/               │
│   ├─ Transaktionale E-Mails (Go-Templates)        → pb_hooks/views/emails/  │
│   ├─ Cron (Event-Erinnerungen)                    → pb_hooks/cron.pb.js     │
│   └─ Collections / Schema                         → pb_migrations/          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Kein Node/Bun zur Laufzeit.** Bun baut nur die statische Site; ausgeliefert
  wird alles vom PocketBase-Binary. Minimaler Footprint, nachhaltig.
- **Statischer Content** (Texte, FAQ, Hero, Moderator …) liegt als **JSON** im
  Repo (`src/content/`, `src/data/`) und wird direkt in Astro eingepflegt.
- **Dynamische Teile** (Event, Anmeldung, Warteliste, Newsletter, Testimonial,
  Atemübung) sind **Svelte-5-Islands**, die per `fetch` mit PocketBase sprechen.

## Projektstruktur

```
src/
  content/        home.json (Block-Reihenfolge + Texte), legal/*.json
  data/           site.json, navigation.json, testimonials.json
  components/      Astro-Blöcke (Hero, Intro, FAQ …), Header, Footer, SEO
  components/islands/  Svelte-5-Islands (Formulare, Breathing, Event, Map …)
  lib/            PocketBase-Client, Utils (toast, motion, umami, calendar …)
  pages/          index, event, atemuebung, teile-deine-erfahrung, [slug]
  styles/         vollständiges CSS-Designsystem (OKLCH, @layer, kein Tailwind)
pocketbase/
  pb_migrations/  Collection-Schema (events, registrations, …)
  pb_hooks/       E-Mail-Logik, Custom-Routen, Cron, Templates
Dockerfile        Multi-Stage: Bun-Build → Alpine + PocketBase
```

## Lokale Entwicklung

Voraussetzungen: [Bun](https://bun.sh) ≥ 1.3.

```bash
bun install

# 1) PocketBase-Binary einmalig holen (Version frei wählbar)
#    https://github.com/pocketbase/pocketbase/releases
#    entpacken nach ./pocketbase/pocketbase

# 2) Backend starten (Port 8090, Admin unter http://localhost:8090/_/)
./pocketbase/pocketbase serve \
  --dir ./pocketbase/pb_data \
  --hooksDir ./pocketbase/pb_hooks \
  --migrationsDir ./pocketbase/pb_migrations

# 3) Frontend-Dev-Server (Port 4321)
echo "PUBLIC_PB_URL=http://localhost:8090" > .env
bun run dev
```

Im Dev-Modus sprechen Astro (4321) und PocketBase (8090) über verschiedene Ports,
daher `PUBLIC_PB_URL`. In Produktion liefert PocketBase die Site selbst aus — dann
bleibt `PUBLIC_PB_URL` leer (same-origin).

### Build

```bash
bun run build        # → dist/   (NICHT `bun --bun run build`, das bricht Rollup)
```

## Deployment mit Coolify

1. Neue Ressource → **Dockerfile**-basiert, dieses Repo.
2. **Persistent Volume** mounten auf `/pb/pb_data` (Datenbank + Uploads).
3. Port **8090** exposen.
4. Environment-Variablen setzen (siehe `.env.example`):

| Variable | Zweck |
|---|---|
| `APP_URL` | öffentliche URL (E-Mail-Links, iCal, Unsubscribe) |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Absender transaktionaler Mails |
| `MAIL_ADMIN_ADDRESS`, `MAIL_ADMIN_NAME` | Empfänger der Admin-Benachrichtigungen |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS` | SMTP-Versand (wird beim Boot in PocketBase übernommen) |
| `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD` | legt beim ersten Start den Admin an |
| `PB_URL` | **Build-Arg**: Live-PocketBase, aus der Events + Testimonials beim Build geholt werden |
| `PUBLIC_SITE_URL` | Build-Zeit: Canonical/Sitemap (Default `https://mens-circle.de`) |
| `DEPLOY_WEBHOOK_URL` | Deploy-Hook, der bei Event-/Testimonial-Änderung einen Rebuild auslöst |
| `DEPLOY_WEBHOOK_METHOD` | HTTP-Methode des Hooks (Coolify: `GET`, Default `POST`) |
| `DEPLOY_WEBHOOK_TOKEN` | wird als `Authorization: Bearer <token>` gesendet (Coolify-API-Token) |
| `DEPLOY_COOLDOWN_SEC` | Mindestabstand zwischen Rebuilds (Default 60) |
| `PUBLIC_UMAMI_ID`, `PUBLIC_UMAMI_ENDPOINT` | optional: Umami-Analytics |

SMTP/Absender werden bei jedem Boot aus den Env-Variablen in die PocketBase-
Einstellungen geschrieben — kein manuelles Klicken im Admin nötig.

### Rebuild bei Content-Änderung (Coolify-Auth)

Events und Testimonials werden zur **Build-Zeit** ins HTML gerendert. Ändert sich
ein solcher Datensatz, pingt der PocketBase-Hook `pb_hooks/deploy.pb.js` den
Deploy-Webhook → Coolify baut neu (Astro holt dabei via `PB_URL` die aktuellen
Daten) → Redeploy. Mehrere schnelle Änderungen fallen zu max. 2 Builds zusammen
(Leading-Edge sofort + Trailing-Sweep per Minuten-Cron).

Coolify-Setup: API-Token unter **Keys & Tokens → API Tokens** anlegen, Ressourcen-
UUID aus der App-URL nehmen, dann:

```
DEPLOY_WEBHOOK_URL=https://<coolify-host>/api/v1/deploy?uuid=<resource-uuid>&force=false
DEPLOY_WEBHOOK_METHOD=GET
DEPLOY_WEBHOOK_TOKEN=<coolify-api-token>
```

Ohne `DEPLOY_WEBHOOK_URL` ist der Trigger ein No-op (z. B. lokal).

Die PocketBase-Version ist als Docker-`ARG PB_VERSION` (Default aktuell
`0.39.3`) überschreibbar.

## Content pflegen

- **Startseiten-Texte / Block-Reihenfolge:** `src/content/home.json`
- **Globale Einstellungen** (Name, Social-Links, WhatsApp-Link, Footer):
  `src/data/site.json`
- **Navigation:** `src/data/navigation.json`
- **Impressum / Datenschutz:** `src/content/legal/*.json`
- **Events, Anmeldungen, Newsletter, Testimonials:** im PocketBase-Admin (`/_/`).

Nach Content-Änderungen am **JSON**: neu deployen (Coolify-Rebuild). **Events und
Testimonials** werden zur Build-Zeit ins HTML gerendert; eine Änderung im
PocketBase-Admin löst über den Deploy-Webhook automatisch einen Rebuild aus
(siehe oben). Anmeldungen/Kapazität bleiben live (die Event-Seite aktualisiert
die freien Plätze clientseitig).

## E-Mails

Automatisch (PocketBase-Hooks): Anmeldebestätigung, Wartelisten-Bestätigung,
Admin-Benachrichtigung, Wartelisten-Nachrückung, Newsletter-Willkommen.
Geplant (Cron, alle 15 min): Event-Erinnerung (heute/morgen).
Batch (Admin-Route): Newsletter-Kampagne an alle aktiven Abonnenten.

Details: siehe [`pocketbase/README.md`](pocketbase/README.md).
