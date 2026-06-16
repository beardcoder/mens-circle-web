# listmonk — Männerkreis Niederbayern/ Straubing

E-Mail-Templates, öffentliches Seiten-CSS und das Deploy-Setup für die
[listmonk](https://listmonk.app)-Instanz, die den Newsletter übernimmt
(Abonnenten, Double-Opt-In, Versand, Abmeldung). Design 1:1 aus den früheren
PocketBase-Mailvorlagen abgeleitet (Farben `#efe9dd` / `#2c2418` / Akzent
`#b86f52`, 600px-Card, DM Sans + Playfair/Georgia).

| Datei                            | Typ in listmonk                 | Zweck                                                                                                                                                         |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`campaign.html`](campaign.html) | **Campaign**-Template           | Rahmen (Card, Gruß, Footer, Tracking) um jeden Newsletter. Enthält `{{ template "content" . }}` — dort wird der im Editor verfasste Kampagnentext eingesetzt. |
| [`optin.html`](optin.html)       | Opt-In-/Willkommens-**Content** | Inhalt der Double-Opt-In-Bestätigungsmail mit „Anmeldung bestätigen"-Button (`{{ .OptinURL }}`). Wird vom Rahmen-Template umschlossen.                        |
| [`public-style.css`](public-style.css) | **Custom CSS** (öffentliche Seiten) | Markenstyling für Anmelde-/Abmelde-/Opt-In-/Archiv-Seiten. Settings → Appearance → „Custom CSS (public pages)".                                        |
| [`docker-compose.yml`](docker-compose.yml) | **Deploy** (App + PostgreSQL) | All-in-one-Stack für Coolify (empfohlen).                                                                                                              |
| [`Dockerfile`](Dockerfile)       | **Deploy** (nur App)            | Standalone-Image; benötigt eine externe PostgreSQL.                                                                                                            |
| [`.env.example`](.env.example)   | Env                             | DB-Zugang + Super-Admin für den Deploy.                                                                                                                        |

## Einrichten

1. listmonk-Admin → **Campaigns → Templates → New template**.
2. `campaign.html` als Typ **Campaign** einfügen und als Standard markieren.
3. Für die Bestätigungsmail den Inhalt aus `optin.html` in die Opt-In-Vorlage
   deiner listmonk-Version übernehmen (das System rendert dort `{{ .OptinURL }}`).
4. Unter **Settings → SMTP** den Mailversand konfigurieren und die Absender-
   Identität (`hallo@mens-circle.de`, „Männerkreis Niederbayern/ Straubing") setzen.

## Templating

listmonk rendert mit Go `html/template` **plus der [Sprig](https://masterminds.github.io/sprig/)-
Funktionsbibliothek** (siehe listmonk-Doku „Templating"). Verfügbar sind also:

**listmonk-eigene Variablen / Funktionen**

| Ausdruck                        | Bedeutung                                           |
| ------------------------------- | --------------------------------------------------- |
| `{{ template "content" . }}`    | Kampagnentext (Pflicht im Campaign-Template)        |
| `{{ .Subscriber.Email }}`       | E-Mail-Adresse des Empfängers                       |
| `{{ .Subscriber.Name }}`        | voller Name                                         |
| `{{ .Subscriber.FirstName }}`   | erstes Wort des Namens (kann leer sein)             |
| `{{ .Subscriber.UUID }}`        | eindeutige Abonnenten-ID                            |
| `{{ .Subscriber.Attribs.xyz }}` | benutzerdefinierte Attribute (z. B. aus dem Import) |
| `{{ .UnsubscribeURL }}`         | Abmelde-Link (pro Empfänger)                        |
| `{{ .MessageURL }}`             | „Im Browser ansehen"-Link                           |
| `{{ .OptinURL }}`               | Bestätigungslink (nur Opt-In-Mail)                  |
| `{{ TrackView }}`               | Öffnungs-Tracking-Pixel                             |
| `{{ TrackLink "https://…" }}`   | Link für Klick-Tracking umschließen                 |
| `{{ Date "2006-01-02" }}`       | formatiertes Datum                                  |
| `{{ Safe "<b>html</b>" }}`      | HTML ungeescaped ausgeben                           |

**Sprig-Funktionen** (Auswahl)

```gotemplate
Hallo {{ .Subscriber.FirstName | default "Freund" }},   {{/* Fallback bei leerem Namen */}}
{{ .Subscriber.Name | title }}                          {{/* Title-Case */}}
{{ .Subscriber.Email | lower }}
{{ now | date "02.01.2006" }}
```

> **Hinweis zur Migration:** Die alte PocketBase-Kampagne ersetzte `{first_name}`
> pro Empfänger. In listmonk schreibst du dafür direkt `{{ .Subscriber.FirstName }}`
> (bzw. mit Fallback `{{ .Subscriber.FirstName | default "…" }}`) in den
> Kampagnentext — keine eigene Ersetzungslogik mehr nötig.

## Öffentliche Seiten gestalten (CSS)

`public-style.css` stylt die öffentlichen listmonk-Seiten (Anmeldung, Abmeldung,
Opt-In-Bestätigung, Archiv) im Männerkreis-Look.

1. listmonk-Admin → **Settings → Appearance**.
2. Inhalt von `public-style.css` in **„Custom CSS (public pages)"** einfügen, speichern.
3. Optional Logo unter **Settings → General** hochladen — es erscheint im `.header`.

Das CSS lädt Playfair Display + DM Sans per Google-Fonts-`@import` und überschreibt
listmonks Default-Selektoren (`.container`, `.wrap`, `.button`, `.lists`, …).

## Deployment

listmonk braucht zwingend **PostgreSQL** (kein SQLite). Zwei Wege:

**A) All-in-one mit Compose (empfohlen)** — `docker-compose.yml` (App + Postgres):

1. Coolify → **New Resource → Docker Compose**, dieses Repo, Base-Directory `listmonk/`.
2. Env-Variablen aus `.env.example` setzen (v. a. starkes `POSTGRES_PASSWORD` +
   `LISTMONK_ADMIN_PASSWORD`).
3. Port **9000** exposen; Coolify terminiert TLS und mappt deine Domain
   (z. B. `listmonk.mens-circle.de`).
4. Erststart legt Schema + Super-Admin automatisch an (kein Install-Wizard).

**B) Nur-App-Image** — `Dockerfile` (`FROM listmonk/listmonk`), wenn du eine
**externe** PostgreSQL betreibst. Dann zusätzlich die `LISTMONK_db__*`-Variablen
setzen (siehe `.env.example`).

Nach dem Deploy:

1. Login mit `LISTMONK_ADMIN_USER` / `LISTMONK_ADMIN_PASSWORD`.
2. **Settings → SMTP**: Mailversand konfigurieren (Absender
   `hallo@mens-circle.de`, „Männerkreis Niederbayern/ Straubing").
3. Liste anlegen (Double-Opt-In), Templates (`campaign.html` / `optin.html`)
   und das Public-CSS einfügen.
4. In der Web-App die `LISTMONK_*`-Variablen setzen (`LISTMONK_URL`,
   `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`, `LISTMONK_LIST_IDS`) — die
   Newsletter-Anmeldung leitet dorthin weiter.
