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

> **Deployment:** listmonk + PostgreSQL laufen jetzt zusammen mit der Web-App in
> der **einen** [`docker-compose.yml`](../docker-compose.yml) im Projekt-Root
> (Coolify „Docker Compose"-Resource). DB-Zugang, Super-Admin und URLs erzeugt
> Coolify automatisch über Magic-Variablen — kein separates listmonk-Setup mehr.

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

Alles läuft über die **eine** [`docker-compose.yml`](../docker-compose.yml) im
Projekt-Root: `web` (Astro + PocketBase + nginx), `listmonk` und `listmonk-db`
(PostgreSQL — listmonk hat kein SQLite).

1. Coolify → **New Resource → Docker Compose**, dieses Repo (Root).
2. Coolify erzeugt Domains + Credentials automatisch über Magic-Variablen
   (`SERVICE_FQDN_WEB_8090`, `SERVICE_FQDN_LISTMONK_9000`, `SERVICE_*_POSTGRES`,
   `SERVICE_*_LISTMONKADMIN`). Den Services im UI die echten Domains zuweisen
   (`web` → mens-circle.de, `listmonk` → listmonk.mens-circle.de).
3. Manuelle Env-Variablen setzen (siehe Root-`.env.example`): `SMTP_*`,
   `PB_ADMIN_*`, und nach dem listmonk-Setup `LISTMONK_API_USER/_TOKEN/_LIST_IDS`.
4. Erststart legt das listmonk-Schema + den Super-Admin automatisch an.

Nach dem Deploy in listmonk:

1. Login als Super-Admin (das von Coolify generierte
   `SERVICE_PASSWORD_LISTMONKADMIN` steht in den Coolify-Env-Variablen).
2. **Settings → SMTP**: Mailversand konfigurieren (Absender
   `hallo@mens-circle.de`, „Männerkreis Niederbayern/ Straubing").
3. Liste anlegen (Double-Opt-In), Templates (`campaign.html` / `optin.html`)
   und das Public-CSS (`public-style.css`) einfügen.
4. API-User anlegen (Settings → API users) und dessen Token in der Web-App als
   `LISTMONK_API_USER` / `LISTMONK_API_TOKEN` + die `LISTMONK_LIST_IDS` setzen.
   Die Web-App ruft listmonk intern über `http://listmonk:9000` auf — die
   Newsletter-Anmeldung der PocketBase-Route leitet dorthin weiter.
