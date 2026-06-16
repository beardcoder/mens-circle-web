# listmonk — Männerkreis Niederbayern/ Straubing

E-Mail-Templates und Public-Page-CSS für die listmonk-Instanz (Newsletter:
Abonnenten, Double-Opt-In, Versand, Abmeldung). Marke: `#efe9dd` / `#2c2418` /
Akzent `#b86f52`, DM Sans + Playfair.

| Datei              | Wohin in listmonk                                                        |
| ------------------ | ------------------------------------------------------------------------ |
| `campaign.html`    | Campaigns → Templates → neues **Campaign**-Template, als Standard setzen |
| `optin.html`       | Inhalt der Opt-In-Bestätigung (nutzt `{{ .OptinURL }}`)                  |
| `public-style.css` | Settings → Appearance → **Custom CSS (public pages)**                    |

## Deployment

listmonk + PostgreSQL laufen mit der Web-App in der einen
[`docker-compose.yml`](../docker-compose.yml) im Root (Coolify „Docker
Compose"). Coolify erzeugt Domains + DB-/Admin-Credentials über Magic-Variablen;
manuell nur `SMTP_*`, `PB_ADMIN_*` und nach dem Setup
`LISTMONK_API_USER/_TOKEN/_LIST_IDS` setzen.

## Nach dem Deploy

1. Als Super-Admin einloggen (Passwort = Coolify `SERVICE_PASSWORD_LISTMONKADMIN`).
2. Settings → SMTP konfigurieren (Absender `hallo@mens-circle.de`).
3. Liste (Double-Opt-In) anlegen, Templates + `public-style.css` einfügen.
4. API-User anlegen → Token in der Web-App als `LISTMONK_API_USER` /
   `LISTMONK_API_TOKEN` + `LISTMONK_LIST_IDS` setzen. Die Web-App ruft listmonk
   intern über `http://listmonk:9000` auf.

## Template-Variablen

listmonk nutzt Go `html/template` + [Sprig](https://masterminds.github.io/sprig/).
Wichtig: `{{ template "content" . }}` (Pflicht im Campaign-Template),
`{{ .Subscriber.FirstName }}`, `{{ .UnsubscribeURL }}`, `{{ .MessageURL }}`,
`{{ .OptinURL }}` (Opt-In), `{{ TrackView }}`. Im Kampagnentext personalisieren
z. B. `Hallo {{ .Subscriber.FirstName | default "…" }}`.
