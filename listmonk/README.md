# listmonk — Männerkreis Niederbayern/ Straubing

E-Mail-Templates und Public-Page-CSS für die listmonk-Instanz (Newsletter:
Abonnenten, Double-Opt-In, Versand, Abmeldung). Marke wie auf **mens-circle.de**:
heller, warmer Pergament-Hintergrund (`#f2eee7`) mit Karte in `#faf8f5`,
Terracotta-/Kupfer-Akzent (`#ce5c22` / Links `#b24e1f`), Serifen-Headlines
(Playfair Display → Fallback Georgia) und sans-serif Fließtext (DM Sans →
Helvetica/Arial), Editorial-Look mit feinen Linien. Die Hex-Werte sind aus den
Website-Tokens (`src/styles/base/_variables.css`, OKLCH) abgeleitet.

Alle Mails sind **e-mail-client-robust** gebaut: table-basiertes Layout,
durchgängig Inline-CSS, web-safe Fonts, MSO-Conditionals und „bulletproof"
Buttons — damit sie auch in Gmail und Outlook solide aussehen (nicht zu 100 %
pixelgleich, aber sauber).

> Getestet gegen **listmonk v6.1.0** (`listmonk/listmonk:latest`, Stand der
> Einrichtung). listmonk nutzt Go `html/template` + Sprig.
> Doku: <https://listmonk.app/docs/templating/>

## Verzeichnisstruktur

```
listmonk/
  Dockerfile                     baked Image: COPY static /listmonk/static
  static/
    email-templates/             ← überschreibt die eingebauten System-Templates
      base.html                  (define "header" + "footer" — gemeinsames Layout)
      subscriber-optin.html      (define "subscriber-optin" — Double-Opt-In-Mail)
      subscriber-optin-campaign.html (define "optin-campaign" — Opt-In als Kampagne)
      subscriber-data.html       (define "subscriber-data" — DSGVO-Datenexport)
      campaign-status.html       (define "campaign-status" — Admin-Benachrichtigung)
      import-status.html         (define "import-status" — Admin-Benachrichtigung)
      forgot-password.html       (define "forgot-password" — Passwort-Reset)
      smtp-test.html             (define "smtp-test" — SMTP-Verbindungstest)
    campaign-templates/
      mens-circle.html           Kampagnen-Template (Quelldatei, manuell in der UI anlegen)
  public-style.css               Settings → Appearance → Custom CSS (public pages)
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
  (`default.tpl`, `default-visual.tpl` …) bleiben aus dem Binary erhalten.
- Dateinamen **und** `{{ define "…" }}`-Blocknamen müssen exakt den Defaults
  entsprechen. Übersicht:

  | Datei | define-Name |
  |---|---|
  | `base.html` | `"header"` + `"footer"` |
  | `subscriber-optin.html` | `"subscriber-optin"` |
  | `subscriber-optin-campaign.html` | `"optin-campaign"` |
  | `subscriber-data.html` | `"subscriber-data"` |
  | `campaign-status.html` | `"campaign-status"` |
  | `import-status.html` | `"import-status"` |
  | `forgot-password.html` | `"forgot-password"` |
  | `smtp-test.html` | `"smtp-test"` |

System-Templates benutzen **Felder/Funktionen aus dem Notification-Kontext**,
nicht die Kampagnen-Funktionen:

- Opt-In-Link: `{{ .OptinURL }}` (Feld) — **nicht** `{{ OptinURL }}`.
- Abmeldelink: `{{ .UnsubURL }}` (Feld).
- `{{ RootURL }}` für Admin-Links; `{{ index . "Name" }}` etc. in den
  Status-Mails.
- `{{ template "header" . }}` (mit Punkt) / `{{ template "footer" }}` (ohne).

### Auslieferung als gebackenes Image (kein Runtime-Bind-Mount)

Die Templates werden **ins Image gebacken** (`listmonk/Dockerfile`), nicht zur
Laufzeit per Bind-Mount eingehängt:

```dockerfile
FROM listmonk/listmonk:latest
COPY static /listmonk/static
```

`docker-compose.yml` baut dieses Image und startet listmonk mit:

```
./listmonk --static-dir=/listmonk/static --config ''
```

`--static-dir` steht nur am **finalen Run-Befehl**, nicht bei
`--install`/`--upgrade`.

> **Warum kein `./listmonk/static:/listmonk/static:ro`-Mount mehr?**
> Repo-relative Bind-Mounts sind auf manchen Hosts (z.B. **Coolify**) fragil:
> wenn der Mount nicht auflöst, fällt listmonk **still** auf seine eingebauten
> englischen Default-Templates zurück — genau das Symptom „Templates gehen
> nicht". Mit dem gebackenen Image liegen die Dateien immer im Container.
> Nach Template-Änderungen daher **Image neu bauen** (`docker compose up
> --build -d listmonk` bzw. Redeploy in Coolify).

## Kampagnen-Template (`campaign-templates/mens-circle.html`)

Kampagnen-Templates leben in listmonk in der **Datenbank**, nicht im Dateisystem
— `--static-dir` überlagert nur die file-basierten **System**-Templates, **nicht**
die Kampagnen-Templates.

### Manuell in der UI anlegen (kein Auto-Seed)

Das Kampagnen-Template wird **nicht** automatisch geseedet. Einmalig anlegen:
Admin → Campaigns → Templates → „New" → Inhalt von
`static/campaign-templates/mens-circle.html` einfügen → als Standard setzen
(`Set as default`).

Pflicht im Body: genau **einmal** `{{ template "content" . }}`. Verwendete
Kampagnen-Funktionen: `{{ .Campaign.Subject }}`, `{{ MessageURL }}`,
`{{ UnsubscribeURL }}`, `{{ TrackLink "https://…" }}`, `{{ TrackView }}`,
`{{ Date "2006" }}`.

## Nach dem Deploy

1. Als Super-Admin einloggen (Passwort = Coolify `SERVICE_PASSWORD_LISTMONKADMIN`).
2. Settings → SMTP konfigurieren (Absender `hallo@mens-circle.de`).
3. Liste (Double-Opt-In) anlegen, `public-style.css` unter Appearance einfügen.
4. Kampagnen-Template einmalig in der UI anlegen (Campaigns → Templates) und als
   Standard setzen — Quelldatei `static/campaign-templates/mens-circle.html`.
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
  hellen Männerkreis-Layout (Pergament, Terracotta-Button) ankommen; „Anmeldung
  bestätigen" zeigt auf `{{ .OptinURL }}`.
- **Testkampagne:** Kampagne mit Template „Männerkreis Niederbayern" anlegen → Admin →
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
