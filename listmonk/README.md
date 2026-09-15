# listmonk — Männerkreis Straubing

E-Mail-Templates und Public-Page-CSS für die listmonk-Instanz (Newsletter:
Abonnenten, Double-Opt-In, Versand, Abmeldung). **Die Mail ist das Plakat** —
dasselbe Design wie auf mens-circle.de, siehe `src/styles/base/_variables.css`:

| Rolle | Hex | Regel |
|---|---|---|
| Sand | `#e8e0d2` | der Grund, auf dem das Blatt liegt |
| Papier | `#f2ede3` | das Blatt selbst |
| Tinte | `#1c1714` | Masthead- und Footer-Band, Überschriften |
| Tinte mittel | `#4a4139` | Fließtext auf Papier (8,5:1) |
| Muted | `#645a50` | Marker, Labels, Meta (5,8:1) |
| Orange | `#dd5f33` | Fläche, Linie, Button — **nie** kleiner Text auf Papier (3,1:1) |
| Haarlinie | `#d8cfbe` | zwischen Zeilen |
| Chalk muted | `#a39786` | der einzige gedämpfte Text, der auf der Tinte trägt (6,2:1) |

Zwei Register, die sich nicht in der Mitte treffen: **Barlow Condensed 800**
versal für Plakatgrößen (44 px, mobil 32 px) und **Barlow** 400/600 für alles
Lesbare (16–17 px). Der 12-px-Marker (condensed, `letter-spacing: .14em`) ist
das Gegengewicht. Die Fonts kommen aus Google Fonts; Apple Mail zeigt sie,
Gmail und Outlook fallen auf Arial Narrow / Helvetica zurück — das
Condensed/Normal-Gefälle bleibt dabei erhalten, nichts hängt am Webfont.

**Radius 0, keine Karte, kein Schatten.** Die weiße Karte mit 14 px Radius auf
Pergament war die alte Identität. Buttons tragen **Tinte auf Orange** (Weiß auf
diesem Orange misst 3,6:1 und fällt durch), Links sind Tinte mit oranger
Unterstreichung.

Zwei bewusste Auslassungen: **kein Ring** (das SVG-Motiv der Website überlebt
keinen Mail-Client — die 4 px orange Linie unter dem Masthead ist sein Ersatz)
und **kein Dark Mode** (`color-scheme: light only` ist in jedem Head gesetzt).
Die Display-Zeilenhöhe ist 0.94 statt 0.85: deutsche Umlaute überschießen die
Versalhöhe, und der `padding-block-start`-Trick der Website greift im
Mail-Client nicht zuverlässig.

Alle Mails sind **e-mail-client-robust** gebaut: table-basiertes Layout,
durchgängig Inline-CSS, MSO-Conditionals und „bulletproof" Buttons — damit sie
auch in Gmail und Outlook solide aussehen (nicht zu 100 % pixelgleich, aber
sauber).

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
      mens-circle.html           Kampagnen-Template (DB-Vorlage, via `bun run listmonk:sync`)
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

### Synchronisieren (kein Auto-Seed)

Das Kampagnen-Template wird **nicht** automatisch geseedet. Aus dem Repo-Root:

```bash
bun run listmonk:sync --dry-run   # zeigt, was sich ändern würde
bun run listmonk:sync             # schreibt
```

Das Skript legt die Vorlage an bzw. aktualisiert sie (zugeordnet über
`LISTMONK_CAMPAIGN_TEMPLATE_ID`, sonst über den Namen) — zusammen mit den
Transaktions-Templates aus `tx-templates/`. **Nach jeder Änderung an der
Quelldatei erneut laufen lassen**, sonst verschickt listmonk weiter die alte
Fassung.

Beim ersten Mal muss die Vorlage danach noch einmal in der UI als Standard
gesetzt werden (`Set as default`) — das kann die API nicht mit erledigen.

Von Hand geht es auch: Admin → Campaigns → Templates → „New" → Inhalt von
`static/campaign-templates/mens-circle.html` einfügen → `Set as default`.

Pflicht im Body: genau **einmal** `{{ template "content" . }}`. Verwendete
Kampagnen-Funktionen: `{{ .Campaign.Subject }}`, `{{ MessageURL }}`,
`{{ UnsubscribeURL }}`, `{{ TrackLink "https://…" }}`, `{{ TrackView }}`,
`{{ Date "2006" }}`.

## Nach dem Deploy

1. Als Super-Admin einloggen (Passwort = Coolify `SERVICE_PASSWORD_LISTMONKADMIN`).
2. Settings → SMTP konfigurieren (Absender `hallo@mens-circle.de`).
3. Liste (Double-Opt-In) anlegen, `public-style.css` unter Appearance einfügen.
4. Kampagnen- und Transaktions-Templates einspielen: `bun run listmonk:sync`
   (Quelldateien `static/campaign-templates/` + `tx-templates/`), danach das
   Kampagnen-Template in der UI als Standard setzen.
5. API-User anlegen → Token in der Web-App als `LISTMONK_API_USER` /
   `LISTMONK_API_TOKEN` + `LISTMONK_LIST_IDS` setzen. Die Web-App ruft listmonk
   intern über `http://listmonk:9000` auf.
   - `LISTMONK_LIST_IDS` = **numerische** Listen-ID (z.B. `1`), wie in der URL
     `.../admin/lists/<ID>`. **Nicht** die UUID der Liste — die Admin-API
     (`POST /api/subscribers`) erwartet Integer-IDs, eine UUID wird verworfen
     und die Person landet in keiner Liste.

## Pro-Veranstaltung-Listen (automatisch)

Jede Veranstaltung bekommt automatisch ihre **eigene listmonk-Liste**, damit du
genau die Teilnehmer einer Veranstaltung anschreiben kannst. Die Logik läuft in
der Datenschicht der Web-App (`src/lib/server/listmonk.ts` + `events.ts`), nicht
in listmonk:

- **Anlegen:** Beim Erstellen einer Veranstaltung wird eine private,
  Single-Opt-In-Liste „**Event: \<Titel\> (\<TT.MM.JJJJ\>)**" erzeugt; die
  numerische Listen-ID wird im Feld `events.listmonk_list_id` gespeichert
  (Fallback: spätestens bei der ersten Anmeldung). Bei Titel-/Datumsänderung wird
  der Listenname automatisch nachgezogen.
- **Eintragen:** Bei jeder Event-Anmeldung wird die Person (dedupliziert über die
  E-Mail) in diese Liste aufgenommen — als `confirmed`, da die Anmeldung selbst
  das Opt-In ist. Eine Person kann gleichzeitig im Newsletter **und** in mehreren
  Event-Listen stehen; es gibt **keine doppelten Abonnenten**.
- **Name nachtragen:** War zuvor kein Name gesetzt (z.B. eine Newsletter-Anmeldung
  ohne Namen, die die E-Mail als Namen hinterlegt), wird der bei der
  Event-Anmeldung angegebene Name am bestehenden listmonk-Abonnenten ergänzt —
  ohne den Bestätigungsstatus anderer Listen (z.B. den noch offenen Newsletter-
  Double-Opt-In) zu verändern.
- **Austragen:** Wird eine Anmeldung storniert (Status `cancelled`), wird die
  Person aus **dieser** Event-Liste entfernt (Newsletter/andere Events bleiben).

Es sind **keine neuen Env-Variablen** für die Listen nötig — die App nutzt
denselben listmonk-Admin-API-Zugang (`LISTMONK_URL`, `LISTMONK_API_USER`,
`LISTMONK_API_TOKEN`). `LISTMONK_LIST_IDS` betrifft nur den Newsletter. Ist
listmonk nicht konfiguriert, laufen Anmeldungen normal weiter (Listen-Sync wird
übersprungen und protokolliert).

## Transaktionale Event-Mails (`tx-templates/`)

Die Event-Mails (Anmeldebestätigung, Warteliste, Erinnerung …) werden über
listmonks **Transactional API** (`POST /api/tx`) versendet. Die Templates dafür
liegen als Quelldateien unter [`tx-templates/`](tx-templates/README.md) und
werden mit `bun run listmonk:sync` in listmonks Datenbank geschrieben — sie
fahren **nicht** im Image mit, eine Änderung an den Dateien erreicht also erst
nach einem Sync ein Postfach. Die zugehörigen Template-IDs werden in der Web-App
als `LISTMONK_TX_*`-Env-Variablen gesetzt.

## Testen

- **Opt-In:** Über das Newsletter-Formular (oder Admin → Subscribers → Add) eine
  Adresse zu einer Double-Opt-In-Liste hinzufügen → die Bestätigungsmail muss im
  Plakat-Layout ankommen (Tinte-Band oben, oranger 4-px-Schnitt, Sandgrund,
  Button orange mit Tinte-Label); „Anmeldung bestätigen" zeigt auf
  `{{ .OptinURL }}`.
- **Testkampagne:** Kampagne mit Template „Männerkreis Straubing" anlegen → Admin →
  „Send test message" an eine eigene Adresse. Prüfen: Hero, oranges
  Statement-Feld, Footer,
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
