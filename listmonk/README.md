# listmonk E-Mail-Templates — Männerkreis Niederbayern/ Straubing

HTML-Templates für die [listmonk](https://listmonk.app)-Instanz, die seit der
Migration den Newsletter übernimmt (Abonnenten, Double-Opt-In, Versand,
Abmeldung). Design 1:1 aus den früheren PocketBase-Mailvorlagen abgeleitet
(Farben `#efe9dd` / `#2c2418` / Akzent `#b86f52`, 600px-Card, DM Sans + Georgia).

| Datei | Typ in listmonk | Zweck |
|---|---|---|
| [`campaign.html`](campaign.html) | **Campaign**-Template | Rahmen (Card, Gruß, Footer, Tracking) um jeden Newsletter. Enthält `{{ template "content" . }}` — dort wird der im Editor verfasste Kampagnentext eingesetzt. |
| [`optin.html`](optin.html) | Opt-In-/Willkommens-**Content** | Inhalt der Double-Opt-In-Bestätigungsmail mit „Anmeldung bestätigen"-Button (`{{ .OptinURL }}`). Wird vom Rahmen-Template umschlossen. |

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

| Ausdruck | Bedeutung |
|---|---|
| `{{ template "content" . }}` | Kampagnentext (Pflicht im Campaign-Template) |
| `{{ .Subscriber.Email }}` | E-Mail-Adresse des Empfängers |
| `{{ .Subscriber.Name }}` | voller Name |
| `{{ .Subscriber.FirstName }}` | erstes Wort des Namens (kann leer sein) |
| `{{ .Subscriber.UUID }}` | eindeutige Abonnenten-ID |
| `{{ .Subscriber.Attribs.xyz }}` | benutzerdefinierte Attribute (z. B. aus dem Import) |
| `{{ .UnsubscribeURL }}` | Abmelde-Link (pro Empfänger) |
| `{{ .MessageURL }}` | „Im Browser ansehen"-Link |
| `{{ .OptinURL }}` | Bestätigungslink (nur Opt-In-Mail) |
| `{{ TrackView }}` | Öffnungs-Tracking-Pixel |
| `{{ TrackLink "https://…" }}` | Link für Klick-Tracking umschließen |
| `{{ Date "2006-01-02" }}` | formatiertes Datum |
| `{{ Safe "<b>html</b>" }}` | HTML ungeescaped ausgeben |

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
