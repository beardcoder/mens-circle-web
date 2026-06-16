# listmonk — Männerkreis Niederbayern/ Straubing

E-Mail-Templates und Public-Page-CSS für die listmonk-Instanz (Newsletter:
Abonnenten, Double-Opt-In, Versand, Abmeldung). Marke: sehr dunkler Hintergrund
(`#090907`), warme Braun-/Kupfer-/Goldtöne (`#c98952`), große Serifenschrift
(Georgia), Editorial-Look mit feinen Linien.

> Getestet gegen **listmonk v6.1.0** (`listmonk/listmonk:latest`, Stand der
> Einrichtung). listmonk nutzt Go `html/template` + Sprig.
> Doku: <https://listmonk.app/docs/templating/>

## Verzeichnisstruktur

```
listmonk/
  static/
    email-templates/        ← überschreibt die eingebauten System-Templates
      base.html             (define "header" + "footer" — gemeinsames Layout)
      subscriber-optin.html (define "subscriber-optin" — Double-Opt-In-Mail)
      subscriber-data.html  (define "subscriber-data" — DSGVO-Datenexport)
      campaign-status.html  (define "campaign-status" — Admin-Benachrichtigung)
      import-status.html    (define "import-status" — Admin-Benachrichtigung)
    campaign-templates/
      mens-circle.html      ← Seed/Referenz, NICHT automatisch geladen (s.u.)
  public-style.css          Settings → Appearance → Custom CSS (public pages)
```

## Eingebaute System-Templates überschreiben (`--static-dir`)

listmonk liefert seine System-Templates als ins Binary **eingebettete** Dateien
unter `static/email-templates/`. Mit `--static-dir` wird ein lokales Verzeichnis
**über** das Embed gelegt.

Wichtige Mechanik (geprüft in `cmd/init.go`, v6.1.0):

- `--static-dir` erwartet ein Verzeichnis mit `email-templates/` und/oder
  `public/`. Nur vorhandene Unterverzeichnisse werden berücksichtigt.
- Der Overlay ist ein **Per-Datei-Merge** (`fs.Merge`): nur die Dateien, die wir
  mitliefern, überschreiben das Embed. Die übrigen Default-Templates
  (`default.tpl`, `smtp-test.html`, `forgot-password.html`,
  `subscriber-optin-campaign.html` …) bleiben aus dem Binary erhalten. Wir
  liefern daher bewusst nur die 5 gebrandeten Dateien — der Rest fällt sauber
  zurück.
- Dateinamen **und** `{{ define "…" }}`-Blocknamen müssen exakt den Defaults
  entsprechen (`header`, `footer`, `subscriber-optin`, `subscriber-data`,
  `campaign-status`, `import-status`), sonst greift der Override nicht.

System-Templates benutzen **Felder/Funktionen aus dem Notification-Kontext**,
nicht die Kampagnen-Funktionen:

- Opt-In-Link: `{{ .OptinURL }}` (Feld) — **nicht** `{{ OptinURL }}`.
- Abmeldelink: `{{ .UnsubURL }}` (Feld).
- `{{ RootURL }}` für Admin-Links; `{{ index . "Name" }}` etc. in den
  Status-Mails.
- `{{ template "header" . }}` (mit Punkt) / `{{ template "footer" }}` (ohne).

Der Container startet listmonk mit:

```
./listmonk --static-dir=/listmonk/static --config ''
```

und mountet dieses Verzeichnis read-only (siehe `docker-compose.yml`):

```yaml
volumes:
  - ./listmonk/static:/listmonk/static:ro
```

`--static-dir` steht nur am **finalen Run-Befehl**, nicht bei
`--install`/`--upgrade`.

## Kampagnen-Template (`mens-circle.html`)

Kampagnen-Templates leben in listmonk in der **Datenbank**, nicht im Dateisystem
— `static/campaign-templates/` wird von listmonk **nicht** geladen. Die Datei
ist nur versionierte Referenz. Einbau:

1. Admin → **Campaigns → Templates → New**, Typ **Campaign / HTML**.
2. Inhalt von `listmonk/static/campaign-templates/mens-circle.html` einfügen.
3. Als Standard setzen (oder pro Kampagne auswählen).

Pflicht: genau **einmal** `{{ template "content" . }}`. Verwendete
Kampagnen-Funktionen: `{{ .Campaign.Subject }}`, `{{ .Subscriber.FirstName }}`,
`{{ MessageURL }}`, `{{ UnsubscribeURL }}`, `{{ TrackLink "https://…" }}`,
`{{ TrackView }}`, `{{ Date "2006" }}`.

## Nach dem Deploy

1. Als Super-Admin einloggen (Passwort = Coolify `SERVICE_PASSWORD_LISTMONKADMIN`).
2. Settings → SMTP konfigurieren (Absender `hallo@mens-circle.de`).
3. Liste (Double-Opt-In) anlegen, `public-style.css` unter Appearance einfügen.
4. Kampagnen-Template `mens-circle.html` unter Templates anlegen (siehe oben).
5. API-User anlegen → Token in der Web-App als `LISTMONK_API_USER` /
   `LISTMONK_API_TOKEN` + `LISTMONK_LIST_IDS` setzen. Die Web-App ruft listmonk
   intern über `http://listmonk:9000` auf.
   - `LISTMONK_LIST_IDS` = **numerische** Listen-ID (z.B. `1`), wie in der URL
     `.../admin/lists/<ID>`. **Nicht** die UUID der Liste — die Admin-API
     (`POST /api/subscribers`) erwartet Integer-IDs, eine UUID wird verworfen
     und die Person landet in keiner Liste.

## Testen

- **Opt-In:** Über das Newsletter-Formular (oder Admin → Subscribers → Add) eine
  Adresse zu einer Double-Opt-In-Liste hinzufügen → die Bestätigungsmail muss im
  dunklen Männerkreis-Layout ankommen; „Anmeldung bestätigen" zeigt auf
  `{{ .OptinURL }}`.
- **Testkampagne:** Kampagne mit Template `mens-circle.html` anlegen → Admin →
  „Send test message" an eine eigene Adresse. Prüfen: Hero/Quote/Footer,
  „Im Browser ansehen" (`MessageURL`), Abmeldelink (`UnsubscribeURL`),
  Tracking-Pixel am Ende (`TrackView`).
- **System-Mails:** SMTP-Test (Settings → SMTP → Test) und ggf. Import-/
  Kampagnenstatus prüfen.

## Hinweise / bewusste Abweichungen

- In `subscriber-data.html` wird **kein** `{{ .Subscriber.FirstName }}`
  verwendet: das Default-Template nutzt dort keinen Subscriber-Kontext, daher
  neutrale Anrede, um Render-Fehler zu vermeiden.
- Die i18n-Strings der Defaults (`{{ L.Ts "…" }}`) wurden durch festen deutschen
  Text ersetzt.
