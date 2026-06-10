# Männerkreis – Frontend & Content Specification

Reverse-engineered from the existing Laravel app (`/Users/markus.sommer/Projekte/Privat/mens-circle`) for a rebuild in **Astro 5 + Svelte 5**.

Site language: German (`<html lang="de" dir="ltr">`). Brand: **Männerkreis Niederbayern / Straubing** — a men's circle landing page.

> **Where content lives in the source app**
> - Static homepage block content + sample event: `database/seeders/DatabaseSeeder.php`
> - Legal pages (Impressum, Datenschutz): `database/seeders/PageSeeder.php`
> - Testimonials: `database/seeders/TestimonialSeeder.php`
> - Navigation (header + footer): `database/seeders/NavigationItemSeeder.php`
> - Site settings (name, tagline, description, footer, social, whatsapp): `database/settings/2025_12_26_163944_create_general_settings.php` (defaults) + `app/Settings/GeneralSettings.php`
> - Per-page hardcoded copy (no-event, breathing, testimonial form, event template): the respective Blade views in `resources/views/`
> - SEO/Schema: `resources/views/partials/seo-head.blade.php`, `app/Seo/Schemas/*`

---

## 1. Page Inventory & Routes

Routes from `routes/web.php`:

| Route | Name | Controller | View | Notes |
|---|---|---|---|---|
| `/` | `home` | `PageController@home` → `show('home')` | `page.blade.php` | Renders CMS content blocks of the `home` page |
| `/home` | — | redirect 301 → `/` | — | |
| `/event` | `event.show` | `EventController@showNext` | redirect to next event, else `no-event.blade.php` | Finds next upcoming published event; redirects to its slug; if none → no-event page |
| `/event/{slug}` | `event.show.slug` | `EventController@show` | `event.blade.php` | Single event (past or upcoming) |
| `/events`, `/events/{slug}` | — | redirect 301 → `/event`, `/event/{slug}` | — | |
| `/teile-deine-erfahrung` | `testimonial.form` | `TestimonialSubmissionController@show` | `testimonial-form.blade.php` | Submit-a-testimonial form |
| `/atemuebung` | `breathing.show` | `BreathingController@show` | `breathing.blade.php` | Interactive Wim-Hof-style breathing exercise |
| `/{slug}` | `page.show` | `PageController@show` | `page.blade.php` | Dynamic CMS pages — seeded: `impressum`, `datenschutz` |
| `/llms.txt` | `llms.txt` | `LlmsController` | text | LLM index file (out of scope for frontend) |
| `/newsletter/unsubscribe/{token}` | `newsletter.unsubscribe` | — | `newsletter/unsubscribed.blade.php` | |

Dynamic CMS pages render their ordered `contentBlocks` via `x-page-content`. The `home` page is itself a CMS page made of blocks.

**Page → sections mapping**

- **Home** (`page.blade.php` + `x-page-content`): ordered content blocks (see §2).
- **Event** (`event.blade.php`): fully hardcoded template — Event Hero → Registration/Waitlist/Past section → Event Info cards → (optional) Map → About section → Final CTA. Driven by an `Event` model, not blocks.
- **No-event** (`no-event.blade.php`): Hero → Info → Newsletter → WhatsApp Community → Back-to-home CTA. All copy hardcoded.
- **Breathing** (`breathing.blade.php`): Hero → instructions + interactive breathing app. All copy hardcoded.
- **Testimonial form** (`testimonial-form.blade.php`): Hero → intro + form. All copy hardcoded.
- **Impressum / Datenschutz** (`page.blade.php`): single `text_section` block each.

---

## 2. HOME Page — Ordered Block List

From `DatabaseSeeder.php` (`$contentBlocks`, rendered in `order`):

1. `hero`
2. `intro`
3. `moderator`
4. `journey_steps`
5. `faq`
6. `newsletter`
7. `cta`

> The block types `archetypes`, `value_items`, `testimonials`, and `whatsapp_community` have full Blade components and are **available** block types in the CMS, but are **not** part of the seeded home page. `testimonials` content (the six quotes) is seeded separately and only renders if a `testimonials` block is added to a page. `whatsapp_community` is rendered standalone on the no-event page. There is **no seeded archetypes/value_items content** anywhere — see §3 for their data shape only.

The block renderer (`components/page-content.blade.php`) maps `block.type` → `x-blocks.{type-with-dashes}`. Special cases: `testimonials` only renders if testimonials exist; `whatsapp_community` and `moderator`/`hero` get extra props.

---

## 3. Block Types — Purpose, Props & Verbatim Content

All copy below is the **exact** German text from the seeders/views. HTML inside titles/quotes (`<span class="text-italic">`, `<br>`, `hero__title-line`) is part of the content and is rendered raw (`{!! !!}`). Reproduce it.

Common optional prop on every block: `anchor` (string) → becomes the section `id` for in-page nav.

### 3.1 `hero`
**Purpose:** Top hero of the home page. Background image, animated circles, label, title, description, primary CTA button.
**Props (`block.data`):** `label`, `title` (HTML), `description`, `button_text`, `button_link`, optional `anchor`, optional media field `background_image`.
**Button resolution:** `button_link` is passed through `CmsButtonLink::resolve()`. If the link contains `/event` (or the event route), it is rewritten to the next upcoming event URL, and the button is **hidden entirely when no upcoming event exists**.
**Seeded content (home):**
- `label`: `Straubing / Niederbayern`
- `title`: `<span class="hero__title-line">Ein Raum für</span><span class="hero__title-line"><span class="text-italic">echte</span> Begegnung</span>`
- `description`: `Der Männerkreis ist ein geschützter Ort, an dem du dich zeigen kannst, wie du wirklich bist. Authentischer Austausch. Ehrliche Gemeinschaft. Persönliches Wachstum.`
- `button_text`: `Dabei sein`
- `button_link`: `/termin`
- Hardcoded UI text in template: scroll hint label `Entdecken`.

### 3.2 `intro`
**Purpose:** "What is a men's circle" — two-column intro with eyebrow, title, body text, a decorative quote, and an inline list of value items.
**Props:** `eyebrow`, `title` (HTML), `text`, `quote` (HTML), `values[]` each `{ number, title, description }`, optional `anchor` (defaults to `ueber`).
**Seeded content (home):**
- `eyebrow`: `Was uns verbindet`
- `title`: `Was ist ein<br><span class="text-italic">Männerkreis?</span>`
- `text`: `Ein Männerkreis ist ein regelmäßiges Treffen von Männern, die sich in einem geschützten Rahmen begegnen möchten. Hier geht es nicht um Smalltalk oder Leistung – sondern um echte Verbindung, ehrliche Worte und das Gefühl, gehört und gesehen zu werden.`
- `quote`: `„Im Kreis sitzen Männer,<br>die sich trauen,<br>echt zu sein."`
- `values`:
  1. `number` `01` · `title` `Authentischer Austausch` · `description` `Hier darfst du sagen, was dich wirklich bewegt – ohne Maske, ohne Rolle.`
  2. `number` `02` · `title` `Ehrliche Gemeinschaft` · `description` `Verbindung entsteht, wenn wir uns gegenseitig wirklich zuhören.`
  3. `number` `03` · `title` `Persönliches Wachstum` · `description` `Durch Reflexion und Feedback entwickeln wir uns gemeinsam weiter.`

### 3.3 `moderator`
**Purpose:** Introduce the facilitator with photo, name, bio (HTML), and a pull quote.
**Props:** `eyebrow`, `name` (HTML), `bio` (HTML), `quote`, optional `anchor` (default `moderator`), optional media field `photo` (falls back to a user-icon placeholder + label `Foto`).
**Decorative:** ornament text `BEGLEITER`.
**Seeded content (home):**
- `eyebrow`: `Dein Begleiter`
- `name`: `Markus<br><span class="light">Sommer</span>`
- `bio`: `<p>Ich bin Markus, gebürtiger Niederbayer und Gründer des Männerkreises Straubing. Seit Jahren beschäftige ich mich mit der Frage, was es bedeutet, als Mann authentisch zu leben – jenseits von Rollenbildern und gesellschaftlichen Erwartungen.</p><p>Der Männerkreis ist für mich ein Herzensanliegen: Ein Ort, an dem wir uns gegenseitig stärken, herausfordern und unterstützen können.</p>`
- `quote`: `„Wahre Stärke zeigt sich nicht im Alleingang, sondern in der Bereitschaft, sich anderen zu öffnen."`

### 3.4 `journey_steps`
**Purpose:** "The journey in the circle" — numbered steps describing a meeting's rhythm. Emits `HowTo` JSON-LD.
**Props:** `eyebrow`, `title` (HTML), `subtitle`, `steps[]` each `{ number, title, description }`, optional `anchor` (default `reise`).
**Seeded content (home):**
- `eyebrow`: `Der Weg`
- `title`: `Die Reise <span class="text-italic">im Kreis</span>`
- `subtitle`: `Jedes Treffen folgt einem natürlichen Rhythmus`
- `steps`:
  1. `1` · `Ankommen` · `Wir beginnen mit einer Runde des Ankommens. Jeder teilt kurz, wie er gerade da ist – körperlich, emotional, mental.`
  2. `2` · `Öffnen` · `Im geschützten Raum des Kreises öffnen wir uns. Themen, die uns bewegen, finden Raum und Gehör.`
  3. `3` · `Wachsen` · `Durch ehrliches Feedback und Spiegelung entstehen neue Perspektiven. Wir lernen von und mit einander.`
  4. `4` · `Integrieren` · `Zum Abschluss verankern wir das Erlebte. Was nehmen wir mit? Was setzen wir im Alltag um?`

### 3.5 `faq`
**Purpose:** Accordion of Q&A. Emits `FAQPage` JSON-LD. Uses native `<details name="...">` (single-open accordion).
**Props:** `eyebrow`, `title` (HTML), `intro`, `items[]` each `{ question, answer }` (answer is HTML), optional `anchor` (default `faq`).
**Seeded content (home):**
- `eyebrow`: `Fragen & Antworten`
- `title`: `Häufige<br><span class="text-italic">Fragen</span>`
- `intro`: `Alles, was du wissen solltest, bevor du zum ersten Mal dabei bist.`
- `items`:
  1. **Q:** `Für wen ist der Männerkreis?`
     **A:** `Der Männerkreis ist offen für alle Männer, die sich nach authentischem Austausch und echten Verbindungen sehnen. Es spielt keine Rolle, ob du 25 oder 65 bist, ob du in einer Beziehung lebst oder Single bist. Wichtig ist nur die Bereitschaft, dich auf den Prozess einzulassen und anderen Männern ehrlich und respektvoll zu begegnen.`
  2. **Q:** `Wo und wie oft trifft sich der Kreis?`
     **A:** `Wir treffen uns in Straubing – der genaue Ort wird bei der Anmeldung bekannt gegeben. Die Treffen finden regelmäßig statt, in der Regel alle zwei bis vier Wochen.`
  3. **Q:** `Wie läuft ein Treffen ab?`
     **A:** `Ein Treffen dauert etwa 2-3 Stunden. Wir sitzen im Kreis – das ist mehr als nur eine Sitzordnung, es ist ein Symbol für Gleichwertigkeit. Der Ablauf folgt einem natürlichen Rhythmus: Ankommen, Öffnen, Wachsen, Integrieren. Es gibt keine starren Regeln, aber Leitlinien wie respektvolles Zuhören und Vertraulichkeit.`
  4. **Q:** `Was kostet die Teilnahme?`
     **A:** `Der Männerkreis funktioniert auf Spendenbasis. Das bedeutet: Jeder gibt, was er kann und was ihm die Erfahrung wert ist. Finanzielle Gründe sollen niemanden davon abhalten, Teil des Kreises zu werden.`
  5. **Q:** `Ist alles vertraulich?`
     **A:** `Ja, absolut. Vertraulichkeit ist das Fundament des Männerkreises. Alles, was im Kreis geteilt wird, bleibt im Kreis.`
  6. **Q:** `Ist das Therapie oder Coaching?`
     **A:** `Nein. Der Männerkreis ist weder Therapie noch Coaching. Es geht nicht darum, Probleme zu lösen oder Ratschläge zu geben. Stattdessen bietet der Kreis einen Raum des Zuhörens und der Verbindung. Bei therapeutischem Bedarf empfehle ich professionelle Hilfe.`

### 3.6 `newsletter`
**Purpose:** Newsletter signup (two-column: copy + email form). Form posts to `window.routes.newsletter`.
**Props:** `eyebrow`, `title` (HTML), `text`, optional `anchor` (default `newsletter`).
**Form (hardcoded):** email input placeholder `Deine E-Mail-Adresse`, submit button `Anmelden`, `sr-only` label `E-Mail-Adresse`.
**Seeded content (home):**
- `eyebrow`: `In Verbindung bleiben`
- `title`: `Bleib <span class="text-italic">verbunden</span>`
- `text`: `Erhalte Informationen zu kommenden Treffen, Impulse zum Thema Männlichkeit und Neuigkeiten aus dem Männerkreis Niederbayern/ Straubing.`

### 3.7 `cta`
**Purpose:** Closing call-to-action with eyebrow, title, text, primary button.
**Props:** `eyebrow`, `title` (HTML), `text`, `button_text`, `button_link`, optional `anchor`. Same `CmsButtonLink` event-link rewriting/hiding as hero.
**Seeded content (home):**
- `eyebrow`: `Nächstes Treffen`
- `title`: `Sei beim <span class="text-italic">nächsten</span><br>Mal dabei`
- `text`: `Der nächste Männerkreis findet bald statt. Sichere dir deinen Platz und erlebe, was echte Männergemeinschaft bedeutet.`
- `button_text`: `Zum Termin & Anmeldung`
- `button_link`: `/termin`

### 3.8 `value_items` (available, not seeded)
**Purpose:** Standalone grid of value items (same item shape as `intro.values`).
**Props:** `eyebrow`, `title`, `items[]` each `{ number, title, description }`, optional `anchor`.
**Content:** none seeded.

### 3.9 `archetypes` (available, not seeded)
**Purpose:** Grid of male-archetype cards. Each card auto-detects a decorative SVG icon by matching the title against keywords: `krieger`→warrior, `liebhaber`→lover, `zauberer`→magician, `könig`/`koenig`→king, `vater`→father, else neutral. SVGs from `public/images/archetypes/{icon}.svg`.
**Props:** `eyebrow`, `title`, `intro`, `items[]` each `{ title, description }`, optional `anchor` (default `archetypen`).
**Content:** none seeded (no archetype copy exists in seeders — only the icon-matching logic and CSS).

### 3.10 `testimonials` (component + seeded data, but not on seeded home)
**Purpose:** Grid of participant quotes. Emits `ItemList`/`Review` JSON-LD. Renders only when published testimonials exist.
**Props:** `testimonials` (collection of `{ quote, author_name?, role? }`), optional `block` with `anchor` (default `stimmen`).
**Hardcoded section copy (not block data):**
- eyebrow `Community Stimmen`
- title `Was <span class="highlight">Teilnehmer</span> sagen`
- subtitle `Authentische Einblicke von Männern, die den Kreis erleben`
**Seeded testimonials (`TestimonialSeeder`, all published, in sort order):**
1. quote `Hier kann ich endlich ich selbst sein, ohne Maske und ohne Leistungsdruck. Der Kreis hat mir einen Raum gegeben, in dem ich mich verletzlich zeigen darf.` — author `Michael` — role `Teilnehmer seit 2023`
2. quote `Der Kreis hat mir gezeigt, dass ich mit meinen Gefühlen und Zweifeln nicht alleine bin. Das hat mir unglaublich viel Kraft gegeben.` — author *(none)* — role *(none)*
3. quote `Eine Oase der Ehrlichkeit in einer Welt voller Fassaden. Hier wird nicht geurteilt, sondern zugehört.` — author `Stefan` — role `Teilnehmer seit 2022`
4. quote `Hier habe ich gelernt, dass Verletzlichkeit keine Schwäche ist, sondern der Mut, sich zu zeigen wie man wirklich ist.` — author *(none)* — role *(none)*
5. quote `Zum ersten Mal habe ich Männer kennengelernt, die wirklich zuhören können. Das hat meine Sicht auf Männlichkeit komplett verändert.` — author `Thomas` — role `Gründungsmitglied`
6. quote `Der Kreis ist ein Raum, in dem ich mich fallen lassen kann. Hier muss ich nicht funktionieren oder stark sein.` — author *(none)* — role `Teilnehmer seit 2024`

### 3.11 `whatsapp_community` (component; used standalone on no-event page)
**Purpose:** Promote the WhatsApp community. Button links to `settings.whatsapp_community_link`.
**Props:** optional `block` with `anchor` (default `whatsapp-community`). All copy is **hardcoded** in the component:
- eyebrow `Community`
- title `Tritt unserer <span class="text-italic">WhatsApp Community</span> bei`
- text `Bleibe mit anderen Männern in Verbindung, erhalte Erinnerungen zu unseren Treffen und tausche dich zwischen den Kreisen aus. Ein Raum für Austausch und gegenseitige Unterstützung.`
- button `Community beitreten` (with WhatsApp icon)
- hint `Kostenlos und unverbindlich`

### 3.12 `page_hero` (available, used for CMS pages)
**Purpose:** Hero for generic CMS pages — eyebrow, title (HTML), lead, optional image, optional button. `align` = `left`|`center` (default center).
**Props:** `eyebrow`, `title` (HTML), `lead`, `align`, `button_text`, `button_link`, optional `anchor`, optional media field `image`.
**Content:** none seeded.

### 3.13 `text_section` (used by legal pages)
**Purpose:** Narrow rich-text content section. Eyebrow + title + HTML content.
**Props:** `eyebrow`, `title`, `content` (HTML), optional `anchor` (defaults to slug of title).
**Seeded content — Impressum:**
- `title`: `Impressum`
- `content` (HTML):
  ```html
  <p><strong>Angaben gemäß § 5 TMG:</strong></p>
  <p>Markus Sommer<br>Männerkreis Niederbayern/ Straubing<br>Musterstraße 1<br>94315 Straubing</p>
  <p><strong>Kontakt:</strong><br>E-Mail: hallo@mens-circle.de</p>
  <p><strong>Hinweis:</strong> Bitte vervollständigen Sie diese Angaben vor Go-Live gemäß Ihren rechtlichen Anforderungen.</p>
  ```
**Seeded content — Datenschutzerklärung:**
- `title`: `Datenschutzerklärung`
- `content` (HTML):
  ```html
  <h3>1. Datenschutz auf einen Blick</h3>
  <p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.</p>
  <h3>2. Allgemeine Hinweise und Pflichtinformationen</h3>
  <p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.</p>
  <h3>3. Newsletter</h3>
  <p>Wenn Sie den auf der Website angebotenen Newsletter beziehen möchten, benötigen wir von Ihnen eine E-Mail-Adresse sowie Informationen, welche uns die Überprüfung gestatten, dass Sie der Inhaber der angegebenen E-Mail-Adresse sind.</p>
  <p><strong>Hinweis:</strong> Bitte vervollständigen Sie diese Datenschutzerklärung vor Go-Live gemäß DSGVO-Anforderungen.</p>
  ```

---

## 4. Non-block Pages — Verbatim Copy

### 4.1 Event page (`event.blade.php`)
Driven by an `Event` model (sample event in `DatabaseSeeder`). Structure & static copy:

- **Hero:** label = `Nächstes Treffen` (or `Vergangenes Treffen` if past). Title = event title. Description = `{Wochentag}, {dd.mm.yyyy} · {HH:MM} Uhr · {location}`. CTA `Jetzt anmelden` (→ `#anmeldung`, hidden if past).
- **Registration section** (`#anmeldung`), three states:
  - *Open:* eyebrow `Sei dabei`; title `Sichere dir <span class="text-italic">deinen Platz</span>`; spots line `{availableSpots} von {max} Plätzen frei`.
  - *Full / waitlist:* eyebrow `Warteliste`; title `Trag dich auf die <span class="text-italic">Warteliste ein</span>`; `Ausgebucht`; hint `Bei Absagen rückt die Warteliste automatisch nach. Du wirst sofort per E-Mail informiert.`
  - *Past:* eyebrow `Rückblick`; title `Dieses Treffen <br><span class="text-italic">hat stattgefunden</span>`; spots `Am {dd.mm.yyyy}`; text `Dieses Treffen liegt in der Vergangenheit. Eine Anmeldung ist nicht mehr möglich.` + `Möchtest du beim nächsten Männerkreis dabei sein? Dann trag dich in unseren Newsletter ein, um über kommende Termine informiert zu werden.`; button `Zum Newsletter anmelden`.
  - **Registration form fields:** Vorname (`Dein Vorname`), Nachname (`Dein Nachname`), E-Mail (`deine@email.de`), Handynummer `(optional)` placeholder `+49 170 1234567` with helper `Für Erinnerungen per SMS am Veranstaltungstag`; privacy checkbox `Ich habe die [Datenschutzerklärung] gelesen und stimme der Verarbeitung meiner Daten zu.`; submit `Verbindlich anmelden` (or `Auf Warteliste eintragen`). Posts to `window.routes.eventRegister`.
- **Event Info cards** (background watermark text `TERMIN`): four cards — `Datum` (weekday + `dd. F Y`), `Uhrzeit` (`{HH:MM} Uhr` / `bis {HH:MM} Uhr`), `Ort` (location / `Genaue Adresse nach Anmeldung`), `Teilnehmer` (`Max. {n}` / `{cost_basis}`). Add-to-calendar: button `In Kalender speichern`, modal title `In Kalender speichern`, `Wähle deinen Kalender:`, buttons `Google Calendar` and `Apple/Outlook (.ics)`.
- **Map section** (only if event has coordinates): eyebrow `Anfahrt`; title `So findest du <span class="text-italic">zu uns</span>`; subtitle = full address/location; buttons `In OpenStreetMap öffnen`, `Route mit Google Maps`; attribution `Karte von [OpenStreetMap]-Mitwirkenden`. Leaflet, lazy-loaded.
- **About section:** eyebrow `Über das Treffen`; title `Ein Raum für <br><span class="text-italic">echte Begegnung</span>`; body = `event.description` (nl2br). Decorative quote `»Gemeinsam<br><span class="text-italic">wachsen</span>,<br>einander<br><span class="text-italic">stärken</span>«`.
- **Final CTA:** *upcoming:* eyebrow `Bereit?`, title `Melde dich <span class="text-italic">jetzt</span> an`, button `Zur Anmeldung`. *past:* eyebrow `Interesse geweckt?`, title `Bleib <span class="text-italic">informiert</span>`, button `Newsletter abonnieren`.

**Sample seeded event** (`DatabaseSeeder`): title `Männerkreis Niederbayern/ Straubing – Januar 2025`, slug `maennerkreis-januar-2025`, date = now+14d, `19:00`–`21:30`, location `Straubing`, location_details `Die genaue Adresse erhältst du nach deiner Anmeldung per E-Mail.`, max 8, cost_basis `Auf Spendenbasis`. Description: `Der Männerkreis ist ein regelmäßiges Treffen von Männern, die sich nach echtem Austausch und authentischer Verbindung sehnen. In einem geschützten Rahmen teilen wir unsere Erfahrungen, Herausforderungen und Erkenntnisse.\n\nEs ist keine Vorerfahrung nötig – bringe einfach dich selbst mit, so wie du gerade bist. Wir freuen uns auf dich!`

### 4.2 No-event page (`no-event.blade.php`)
- **Hero:** label `Männerkreis Niederbayern/ Straubing`; title `Aktuell ist kein / Termin geplant` (markup: `<span class="hero__title-line">Aktuell ist kein</span><span class="hero__title-line"><span class="text-italic">Termin</span> geplant</span>`); description `Wir planen gerade unser nächstes Treffen. Melde dich für unseren Newsletter an oder tritt unserer WhatsApp-Community bei, um als Erster zu erfahren, wann es weitergeht.`; buttons `Zum Newsletter` (→ `#newsletter`) + scroll hint `Mehr erfahren`.
- **Info:** eyebrow `Was ist der Männerkreis?`; title `Ein Raum für <span class="text-italic">echte Begegnung</span>`; text `Der Männerkreis Niederbayern/ Straubing bietet dir einen geschützten Raum, in dem du dich mit anderen Männern austauschen, wachsen und echte Verbindungen aufbauen kannst. Unsere Treffen finden regelmäßig statt – sobald der nächste Termin feststeht, informieren wir dich.`; decorative quote `»Bleib<br><span class="text-italic">verbunden</span>«`.
- **Newsletter** (`#newsletter`): eyebrow `Newsletter`; title `Bleib <span class="text-italic">informiert</span>`; text `Erhalte als Erster Bescheid, wenn unser nächstes Treffen stattfindet. Kein Spam, nur relevante Informationen zum Männerkreis.`; input placeholder `Deine E-Mail-Adresse`, button `Anmelden`.
- **WhatsApp Community:** the `whatsapp_community` component (see §3.11).
- **Back-to-home CTA:** eyebrow `Mehr erfahren`; title `Entdecke den <span class="text-italic">Männerkreis</span>`; text `Erfahre mehr über uns, unsere Werte und was dich bei einem Treffen erwartet.`; button `Zur Startseite`.

### 4.3 Breathing page (`breathing.blade.php`)
- **Hero:** label `Bewusster Atem`; title `Atem<span class="highlight">übung</span>`; subtitle `Drei Runden bewusster Atem im Stil der Wim-Hof-Methode. Für Klarheit, Energie und innere Ruhe.`
- **Instructions:** heading `So funktioniert es`; ordered steps:
  1. `Tief atmen:` `35 kräftige Atemzüge — vollständig einatmen, locker ausatmen.`
  2. `Halten:` `Nach der letzten Ausatmung den Atem so lange wie möglich anhalten.`
  3. `Erholung:` `Tief einatmen und 15 Sekunden halten. Dann normal weiteratmen.`
  - Warning `Wichtig:` `Übe niemals im Wasser oder beim Autofahren. Setze oder lege dich entspannt hin.`
- **Interactive app** (client-side, `data-lume="breathing-app"`): phase label default `Bereit`; counter `3 Runden · 35 Atemzüge`; meta labels `Runde` (`0 / 3`), `Atemzug` (`0 / 35`), `Zeit` (`00:00`); controls — start (play icon, aria `Atemübung starten`), `Atem freigeben`, `Zurücksetzen`; settings — `Atemzüge je Runde` (slider 10–60, default 35), `Runden` (stepper 1–6, default 3), `Erholungs-Halt (Sek.)` (stepper 5–30, default 15).

### 4.4 Testimonial form page (`testimonial-form.blade.php`)
- **Hero:** label `Community Stimmen`; title `Teile deine <span class="highlight">Erfahrung</span>`; subtitle `Deine Geschichte kann anderen Männern Mut machen, den ersten Schritt zu wagen.`
- **Intro:** heading `Deine Stimme zählt`; `Der Männerkreis lebt von authentischen Begegnungen. Wenn du Teil unserer Community bist und deine Erfahrung teilen möchtest, würden wir uns freuen, von dir zu hören.`; `Dein Testimonial wird nach Prüfung auf unserer Website veröffentlicht und kann anderen Männern helfen zu verstehen, was der Kreis bedeuten kann.`
- **Form** (posts to `testimonial.submit`):
  - `Deine Erfahrung *` — textarea, 10–1000 chars, placeholder `z.B. "Hier kann ich endlich ich selbst sein, ohne Maske und ohne Leistungsdruck..."`, hint `Mindestens 10 Zeichen, maximal 1000 Zeichen`, live counter `0/1000`.
  - `Dein Name (optional)` — placeholder `z.B. Michael oder anonym lassen`, hint `Leer lassen für ein anonymes Testimonial`.
  - `Rolle/Beschreibung (optional)` — placeholder `z.B. Teilnehmer seit 2023`.
  - `E-Mail-Adresse *` — placeholder `deine@email.de`, hint `Wird nicht veröffentlicht. Nur für Rückfragen.`
  - Privacy checkbox `Ich habe die [Datenschutzerklärung] zur Kenntnis genommen und bin damit einverstanden, dass meine Daten zum Zwecke der Veröffentlichung gespeichert werden. *`
  - Submit `Erfahrung teilen`. Note `Alle Felder mit * sind Pflichtfelder.` + `Dein Testimonial wird nach Prüfung durch uns veröffentlicht.`

---

## 5. Header & Navigation

From `layouts/app.blade.php` + `NavigationItemSeeder`. The layout splits header nav items into normal links vs. CTA links (`is_cta`).

- **Logo:** SVG (`<x-logo>` → sprite `#icon-logo`, a circular brand mark — full path data in `components/sprite-defs.blade.php`) + text label `Männerkreis`. Links to home; aria-label `{site_name} - Startseite`.
- **Header nav items** (location `Header`, ordered by `sort`):
  | Label | URL | Notes |
  |---|---|---|
  | `Über` | `#ueber` | umami target `ueber` |
  | `Die Reise` | `#reise` | `reise` |
  | `Fragen` | `#faq` | `faq` |
  | `Atemübung` | `/atemuebung` | `atemuebung` |
  | `Nächster Termin` | (dynamic) | **CTA** (`is_cta`), condition `NextEvent` — link resolves to next event; shown only when a next event exists |
- Each nav link shows a two-digit index (`01`, `02`, …) + label.
- **Decorative:** ambient concentric rings (mobile), nav meta text `Atme durch. Du bist angekommen.`, side-rails `Männerkreis · Niederbayern` (left) and `Straubing · Bayern` (right) — hidden on small screens.
- **Mobile menu:** hamburger button `#navToggle` (`aria-controls="nav"`, `aria-expanded`), aria-label `Menü öffnen`; toggles the nav drawer (JS `data-lume="site-header"`).
- **Skip link:** `Zum Inhalt springen` → `#main`. Top sentinel `<span id="top">` for scroll-to-top.
- **Scroll-to-top** floating link → `#top`, aria `Nach oben scrollen`, title `Nach oben`, chevron-up icon (CSS scroll-driven).

---

## 6. Footer

From `layouts/app.blade.php` + `NavigationItemSeeder` + settings.

- **Brand column:** logo + `{site_name}` (default `Männerkreis Niederbayern`); description text = `settings.site_description` or fallback `Ein Raum für echte Begegnung unter Männern. Authentischer Austausch, Gemeinschaft und persönliches Wachstum in Niederbayern.`; social icons from `settings.social_links` (rendered via `<x-social-icon variant="link">`).
- **Navigation column** (`Navigation`): footer-primary items, ordered:
  - `Über uns` → `#ueber`
  - `Die Reise` → `#reise`
  - `FAQ` → `#faq`
  - `Atemübung` → `/atemuebung`
  - `Nächster Termin` → dynamic (condition `NextEvent`)
- **Contact column** (`Kontakt`): if set, `E-Mail schreiben` (mailto `settings.contact_email`) and phone (`settings.contact_phone`, as tel:); plus footer-contact items:
  - `Newsletter` → `#newsletter`
- **Bottom bar:** copyright = `settings.footer_text` (default `© {year} Männerkreis Niederbayern. Alle Rechte vorbehalten.`; layout fallback `© 2024 Männerkreis Niederbayern`). Legal links (footer-legal, ordered):
  - `Impressum` → `/impressum`
  - `Datenschutz` → `/datenschutz`

**Social link types** (`SocialLinkType` enum): `email`, `phone`, `instagram`, `facebook`, `twitter`, `linkedin`, `youtube`, `whatsapp`, `telegram`, `website`, `other` — each maps to a sprite icon (`social-*`) and a German label (e.g. `E-Mail`, `Telefon`, `Twitter (X)`, `Sonstiges`). Each social link object is `{ type, value, label? }`.

**Site settings defaults** (from settings migration):
- `site_name`: `Männerkreis Niederbayern`
- `site_tagline`: `Ein Raum für echte Begegnung`
- `site_description`: `Der Männerkreis ist ein geschützter Ort, an dem du dich zeigen kannst, wie du wirklich bist.`
- `contact_email`: `kontakt@mens-circle.de`
- `contact_phone`: `` (empty)
- `location`: `Niederbayern`
- `whatsapp_community_link`: `` (empty)
- `social_links`: `[]`
- `footer_text`: `© {year} Männerkreis Niederbayern. Alle Rechte vorbehalten.`
- `event_default_max_participants`: `8`

---

## 7. SEO Head & Structured Data

From `partials/seo-head.blade.php`. Defaults shown; per-page Blade `@section`s override.

**Meta tags:**
- `<title>`: page title, fallback `{site_name} – {site_tagline}`.
- `meta[name=title]`, `meta[name=description]` (fallback `Authentischer Austausch, Gemeinschaft und persönliches Wachstum für Männer in Niederbayern.`), `meta[name=keywords]` (default `Männerkreis, Niederbayern, Männergruppe, persönliches Wachstum, Gemeinschaft, Männer`).
- `meta[name=author]` = `Markus Sommer`.
- `<link rel=canonical>` = current URL (overridable). `hreflang` `de` + `x-default` both = canonical.
- Theme: `theme-color` `#3d2817`, `color-scheme` `light`, `msapplication-TileColor` `#3d2817`.

**Open Graph:** `og:type` (default `website`; event page uses `event`), `og:url` (current), `og:title` (fallback site_name), `og:description`, `og:image` (default `images/logo-color.png`, 1200×630), `og:image:alt` (default `Männerkreis Niederbayern/ Straubing - Gemeinschaft für Männer`), `og:locale` `de_DE`, `og:site_name`.

**Twitter:** `summary_large_image` card, url/title/description/image/image:alt (defaults mirror OG; image fallback `images/logo-color.png`).

**Robots:** default `index, follow` (`robots` + `googlebot`). Legal pages set `noindex, nofollow`.

**Assets:** preloads variable font woff2 (Playfair Display + DM Sans, latin subsets), favicon set (`favicon.svg`, 32/16 png, apple-touch 180, `manifest.json`), Vite CSS, Umami analytics include.

**JSON-LD schemas** (injected globally in head + per-block pushes):
- **LocalBusiness** (`#organization`): name, description, url, logo (`images/logo-color.png` 512²), email, address `Straubing / Bayern / 94315 / DE`, geo `48.8777, 12.5731`, areaServed geoCircle radius 50000, priceRange `€`, openingHours Mon–Fri 09:00–18:00, optional telephone, `sameAs` from social links.
- **Organization** (`#organization`): name, url, logo, description, email, address `Straubing / Bayern / DE`, areaServed `Niederbayern`, `sameAs`.
- **WebSite** (`#website`): name, url, description, `inLanguage de-DE`, publisher → `#organization`, SearchAction `?s={search_term_string}`.
- **Per page (pushed):**
  - `journey_steps` block → `HowTo` (name from title, steps with name+text).
  - `faq` block → `FAQPage` (questions/answers).
  - `testimonials` block → `ItemList` of `Review` (reviewBody, author Person, itemReviewed `#organization`).
  - Event page → `Event` schema (start/endDate, eventStatus `EventScheduled`, attendanceMode `OfflineEventAttendanceMode`, location place w/ address+geo, organizer/performer `#organization`, offer price `0 EUR` availability InStock/SoldOut, max/remaining capacity, `inLanguage de`) + `BreadcrumbSchema`.
  - No-event / Breathing / Testimonial pages → `BreadcrumbSchema` + `WebPageSchema` (title + description). Breadcrumb labels: `Startseite` + (`Veranstaltungen` / `Atemübung` / `Teile deine Erfahrung`).

---

## 8. Proposed Astro Content Structure

Static, German content does not need a DB. Use Astro **content collections** (or plain JSON imported by pages). Suggested layout under `src/content/` + `src/data/`:

```
src/
  content/
    pages/
      home.json            # ordered blocks for the home page (see shape below)
    legal/
      impressum.json       # { title, content (HTML), meta }
      datenschutz.json
  data/
    site.json              # global settings (name, tagline, description, contact, footer, social, whatsapp, geo)
    navigation.json        # header + footer nav groups
    testimonials.json      # array of { quote, author?, role? }
    seo.json               # default meta/OG/twitter values + schema constants
    event.json (optional)  # single/next event if events stay static; else fetch from API/CMS
```

### 8.1 `data/site.json`
```json
{
  "siteName": "Männerkreis Niederbayern",
  "tagline": "Ein Raum für echte Begegnung",
  "description": "Der Männerkreis ist ein geschützter Ort, an dem du dich zeigen kannst, wie du wirklich bist.",
  "footerDescription": "Ein Raum für echte Begegnung unter Männern. Authentischer Austausch, Gemeinschaft und persönliches Wachstum in Niederbayern.",
  "contactEmail": "kontakt@mens-circle.de",
  "contactPhone": "",
  "location": "Niederbayern",
  "whatsappCommunityLink": "",
  "footerText": "© 2026 Männerkreis Niederbayern. Alle Rechte vorbehalten.",
  "socialLinks": [],
  "geo": { "lat": 48.8777, "lng": 12.5731, "locality": "Straubing", "region": "Bayern", "postalCode": "94315", "country": "DE" },
  "themeColor": "#3d2817"
}
```

### 8.2 `data/navigation.json`
```json
{
  "header": {
    "links": [
      { "label": "Über", "url": "#ueber" },
      { "label": "Die Reise", "url": "#reise" },
      { "label": "Fragen", "url": "#faq" },
      { "label": "Atemübung", "url": "/atemuebung" }
    ],
    "cta": [
      { "label": "Nächster Termin", "url": "/event", "condition": "nextEvent" }
    ],
    "meta": "Atme durch. Du bist angekommen."
  },
  "footerPrimary": [
    { "label": "Über uns", "url": "#ueber" },
    { "label": "Die Reise", "url": "#reise" },
    { "label": "FAQ", "url": "#faq" },
    { "label": "Atemübung", "url": "/atemuebung" },
    { "label": "Nächster Termin", "url": "/event", "condition": "nextEvent" }
  ],
  "footerContact": [
    { "label": "Newsletter", "url": "#newsletter" }
  ],
  "footerLegal": [
    { "label": "Impressum", "url": "/impressum" },
    { "label": "Datenschutz", "url": "/datenschutz" }
  ]
}
```

### 8.3 `content/pages/home.json` (ordered blocks)
A discriminated-union array — each entry has a `type` and a `data` object matching §3. Example:
```json
{
  "meta": {
    "title": "Männerkreis Niederbayern/ Straubing",
    "description": "Authentischer Austausch, Gemeinschaft und persönliches Wachstum für Männer in Niederbayern.",
    "keywords": "Männerkreis, Niederbayern, Männergruppe, persönliches Wachstum, Gemeinschaft, Männer"
  },
  "blocks": [
    { "type": "hero", "data": { "label": "...", "title": "...", "description": "...", "buttonText": "Dabei sein", "buttonLink": "/event" } },
    { "type": "intro", "data": { "eyebrow": "...", "title": "...", "text": "...", "quote": "...", "values": [ { "number": "01", "title": "...", "description": "..." } ] } },
    { "type": "moderator", "data": { "eyebrow": "...", "name": "...", "bio": "...", "quote": "...", "photo": "..." } },
    { "type": "journeySteps", "data": { "eyebrow": "...", "title": "...", "subtitle": "...", "steps": [ { "number": "1", "title": "...", "description": "..." } ] } },
    { "type": "faq", "data": { "eyebrow": "...", "title": "...", "intro": "...", "items": [ { "question": "...", "answer": "..." } ] } },
    { "type": "newsletter", "data": { "eyebrow": "...", "title": "...", "text": "..." } },
    { "type": "cta", "data": { "eyebrow": "...", "title": "...", "text": "...", "buttonText": "...", "buttonLink": "/event" } }
  ]
}
```
(Fill the `...` with the verbatim copy from §3.)

### 8.4 `data/testimonials.json`
```json
[
  { "quote": "Hier kann ich endlich ich selbst sein, ...", "author": "Michael", "role": "Teilnehmer seit 2023" },
  { "quote": "Der Kreis hat mir gezeigt, ...", "author": null, "role": null }
]
```
(All six from §3.10.)

### 8.5 `content/legal/*.json`
```json
{ "title": "Impressum", "robots": "noindex, nofollow", "content": "<p><strong>Angaben gemäß § 5 TMG:</strong></p>..." }
```

### 8.6 Astro component mapping
One Svelte/Astro component per block type, plus shared layout pieces:
- `Hero.astro`, `Intro.astro`, `Moderator.astro`, `JourneySteps.astro`, `Faq.astro`, `Newsletter.svelte` (interactive form), `Cta.astro`, `ValueItems.astro`, `Archetypes.astro`, `Testimonials.astro`, `WhatsappCommunity.astro`, `PageHero.astro`, `TextSection.astro`.
- Layout: `Header.astro` (+ `MobileNav.svelte` for the toggle), `Footer.astro`, `SeoHead.astro`, `SocialIcon.astro`, `Sprite.astro` / sprite-defs partial, `ScrollToTop`.
- Interactive (Svelte 5 islands, `client:*`): newsletter form, event registration form, testimonial form (char counter), breathing app, add-to-calendar modal, Leaflet map, mobile nav toggle.
- A `<PageContent>` renderer iterates `blocks[]` and switches on `type` → component, mirroring `components/page-content.blade.php`.

### 8.7 Notes for the rebuild
- **Rich text:** `title`, `quote`, `bio`, `faq.answer`, `text_section.content`, no-event/event titles contain intentional inline HTML (`<span class="text-italic">`, `<br>`, `hero__title-line`, `highlight`, `light`). Render raw (Astro `set:html` / Svelte `{@html}`). Keep these classes — they drive the editorial typography.
- **Event link behavior:** any `buttonLink` pointing at the event must (a) resolve to the next event URL and (b) hide the button when no upcoming event exists. Recreate `CmsButtonLink` logic.
- **Archetypes & value_items:** components exist but have **no real content** — only build them if you intend to author archetype copy (warrior/lover/magician/king/father icons available).
- **Decorative chrome to preserve:** animated `hero__circle`s, side-rails, nav ambient rings, `BEGLEITER`/`TERMIN` watermark texts, scroll hints (`Entdecken`, `Mehr erfahren`).
- **Icons:** all UI/social icons are inline SVG symbols defined once in `sprite-defs` and referenced via `<use href="#icon-...">`. Port the sprite (logo, chevron-up, play, calendar, user, social-*).
- **Analytics:** Umami via `data-umami-event*` attributes throughout (nav, CTA, footer, social, faq-expand, breathing-*, map-click, contact-click). Carry over if analytics is kept.
```

---

## Quick reference: block → component file
| Block type | Blade component |
|---|---|
| `hero` | `components/blocks/hero.blade.php` |
| `intro` | `components/blocks/intro.blade.php` |
| `value_items` | `components/blocks/value-items.blade.php` |
| `archetypes` | `components/blocks/archetypes.blade.php` |
| `journey_steps` | `components/blocks/journey-steps.blade.php` |
| `moderator` | `components/blocks/moderator.blade.php` |
| `testimonials` | `components/blocks/testimonials.blade.php` |
| `faq` | `components/blocks/faq.blade.php` |
| `cta` | `components/blocks/cta.blade.php` |
| `newsletter` | `components/blocks/newsletter.blade.php` |
| `whatsapp_community` | `components/blocks/whatsapp-community.blade.php` |
| `page_hero` | `components/blocks/page-hero.blade.php` |
| `text_section` | `components/blocks/text-section.blade.php` |
