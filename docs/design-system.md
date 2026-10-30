# Design system

## Idea — a fire circle at the edge of the forest

A men's circle meets in the evening, sits in a ring and listens. The site looks like
that evening: deep forest green for what draws you in, the warm ember of the logo
for the one thing to do, linen daylight for reading. The circle is the one motif —
the photograph in a ring, three warm points on it (the three figures of the logo),
the seats around the date, numbered steps on a path, the breath above the hills of
the Bavarian Forest. Shapes are soft and round.

Four principles: make the next step visible, group what belongs together, keep
reading lines short, use the same component for the same function. Everything is
fast: two font files (~37 kB), one stylesheet, images sized at build time.

## Stance — hold the space, don't perform

The page acts the way a circle leader does. Leading a circle means holding the
space instead of performing: listening, explaining the frame, asking for consent,
then stepping back. Translated into design:

- **Quiet.** Few effects, much air, one action per module. Lists rather than card
  grids where things are said one after the other (the questions of the first
  round, the agreements). A shadow only on what you act on: the date card, the
  forms, an open question.
- **Safe and clear.** The frame is visible before anyone comes: how an evening
  runs, what we agree on, that every exercise is an offer, that "no" is always a
  good answer, that it is no therapy. Nothing is hidden behind a click that a
  hesitant visitor needs to decide.
- **Grounded.** Nature, body and breath, never lofty: forest, hills, fire and the
  breath as concrete things, no cosmic imagery, no gradients for their own sake.
- **The circle.** The ring is the space everyone shares; the seats around the date
  show how many seats are taken and how many are still free.
- **Open to every man.** Language that excludes no one (age, origin, faith, with
  whom you share your life); "du", plain German, no jargon and no "brother" tone.

## Voice

German, "du", short sentences, first person where Markus speaks. Describe what
happens, not what it should make you feel. Name the frame in plain words: the five
agreements are Vertraulichkeit, Ehrlichkeit, Annehmen statt bewerten, Von sich
sprechen and Ein geschützter Ort (the training's CHAOS: confidentiality, honesty,
acceptance, ownership, sacred). The evening's arc is Ankommen, die erste Runde,
Teilen und zuhören, Den Kreis schließen. Every invitation to take part comes with
the permission not to. No promises of healing; the circle is no therapy and says so.

## Files

| File                      | Role                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`    | Tokens (`@theme`), primitives, variants, the three surfaces, keyframes, base rules. Shared.                                                  |
| `src/styles/global.css`   | Public entry: Tailwind (classes from `src/` only), theme, view transitions, the breath and the hero's turning ring.                          |
| `src/styles/admin.css`    | Admin entry: Tailwind and theme; AdminLayout pins the dark mode (the forest at night).                                                       |
| `src/lib/ui.ts`           | Class recipes: `button()`, `control()`, `link`, `label`, `fieldLabel`, `fieldHint`, `fieldError`, `formStatus`, `checkbox`, `card`, `panel`. |
| `src/lib/event-status.ts` | The view model every date summary renders (`eventView`, `splitFee`).                                                                         |
| `src/lib/seats.ts`        | The ring of seats (`seatRing`), shared by the date seal and the registration panel; imports nothing, so client code may use it.              |
| `src/components/ui/`      | The components built on them; `src/icons/` the line icons (24px grid, 1.7 stroke).                                                           |

## Colour

Primitives (`--p-*`) are plain hex values on `:root`; the roles pick them with
`light-dark()`, so day and night (`data-mode`, set before first paint, switched by
`ModeToggle`) keep the same roles. Never a hex value in markup.

| Role            | Light                        | Night                 | Token                            | Use                                           |
| --------------- | ---------------------------- | --------------------- | -------------------------------- | --------------------------------------------- |
| Page            | `#F6F2EA` linen              | `#111915`             | `ground`                         | the page                                      |
| Warm band       | `#ECE4D4` sand               | `#17201A`             | `ground-alt` (`surface-alt`)     | information that belongs together             |
| Quiet note      | `#E2E7D8` sage               | `#1C2720`             | `tint` (`surface-tint`)          | agreements, a hint beside the work            |
| Card            | `#FFFCF6` cream              | `#1E2922`             | `raised`                         | cards, tiles, panels                          |
| Forest          | `#16221B` / raised `#213029` | `#0C130F` / `#18221C` | `surface-dark`                   | opening, breath, registration, menu, footer   |
| Text            | `#1B241E` / soft `#2E372F`   | `#ECE7DC`             | `fg`, `fg-soft`                  | titles / running text                         |
| Secondary text  | `#5A6255` moss               | `#A6AE9F`             | `fg-muted`                       | labels, notes, captions                       |
| Lines           | `#DDD5C5` / `#C8BFAC`        | `#2A362E` / `#3B4940` | `line`, `line-strong`            | quiet structure; never alone a control        |
| Control outline | `#7A8072`                    | `#7E8878`             | `line-bold`                      | inputs, secondary buttons (≥ 3:1)             |
| Accent          | `#9A421D` (hover `#953F1C`)  | `#F2A56C`             | `accent`, `accent-strong`        | links, labels, a highlighted word, free seats |
| Accent tint     | `#F5DFCD`                    | `#3A2619`             | `accent-soft`                    | icon discs, the date seal, the quote card     |
| Primary action  | `#B4532A` ember / `#953F1C`  | same                  | `fill`, `fill-strong`, `on-fill` | the one action of a module                    |
| Glow            | `#E8B65A`                    | same                  | `glow`                           | the warm point of the circle; never text      |

On the forest, `surface-dark` re-declares text (`#F2EDE3` bone, `#B4BBAD` muted),
accent (`#F2A56C`), lines (bone at 14 / 24 %) and the control outline (`#768379`).
`success`, `danger` and `alert` are for real states only and always come with words.
Every text pair holds at least 4.5:1 on every ground in both modes, every control
line at least 3:1 (checked pair by pair; the tightest are the control outline on sand,
3.2:1, and white on ember, 4.7:1). Check any new pair in both modes.

## Type

`font-display` is Fraunces at its one weight, 500 — warm, a little old-fashioned,
steady: titles, the quote, the date, numbers in circles, the menu. `font-sans` is
Figtree (variable, 400–700) — clear and friendly: running text, navigation, forms,
data, FAQ questions. Fraunces ships as one static face (~18 kB), Figtree as one
variable file (~20 kB); both upright faces preload, Figtree's italic loads when used.
There is no italic display face: a highlighted phrase in a title (`<em>`) turns the
accent colour and stays upright.

| Token          | Size      | Use                                       |
| -------------- | --------- | ----------------------------------------- |
| `text-hero`    | 42–80px   | the home statement                        |
| `text-page`    | 38–68px   | a sub-page's title, the breath line       |
| `text-section` | 32–52px   | a section's title                         |
| `text-sub`     | 22–30px   | subheadings, card titles, a fact's value  |
| `text-quote`   | 24–34px   | one short highlighted quote               |
| `text-xl`      | 18–22px   | FAQ questions, data values                |
| `text-lg`      | 18–21px   | a lead                                    |
| `text-md`      | 17–19px   | running text (the body)                   |
| `text-base`    | 16px      | controls, buttons, data                   |
| `text-sm`/`xs` | 14 / 13px | labels, hints, captions / the small print |

Titles tighten their tracking as they grow (−1 % to −3 %). Labels are sentence case:
the section label (`Eyebrow`) in the accent after a small ember dot, data labels
(`label`) in the secondary colour. Running text stays on `max-w-measure` (~62
characters), aligned left. Long words hyphenate; a hyphenated word that must not
break at its hyphen uses U+2011 ("E‑Mail" in a big title).

## Space and grid

One content width, 1200px, and **one edge**: the content sits 28 / 44 / 60px from
the window (`gutter`) in every section, on the page and in a sheet alike, and the
header shares it. `Container` pads by `--page-pad`: the gutter on the page; in a
sheet (`sheet`, which stands `inset` 8 / 12px in) the gutter minus the inset, 20 /
32 / 48px (`sheet`). Consecutive sheets keep one inset between them, so no two
grounds touch.

Inside, two paddings only: `card` 24 / 28 / 32px for every card and tile (a date,
a fact, a voice, a note, an FAQ item, the calendar dialog), `panel` 28 / 40 / 48px
for a large card that holds a form or the quote (`panelPadding`: on phones it
reaches out to the sheet inset and pads by `sheet`, so its content keeps the page's
edge instead of a second indent). Cards in a list stand `stack` 16 / 20 / 24px
apart. A card is never nested in a card; a second part of a card is parted by a
line.

Space per width on `:root`: `py-section` 72 → 112px, `py-band` 48 → 64px, `group`
32 → 48px (an explanation to the module after it), `grid` 32 → 48px (column gap).
An eyebrow stands 16px above its title. Breakpoints: `sm` 36rem, `md` 48rem, `lg`
64rem, `nav` 68.75rem (the header shows its links), `xl` 80rem. No section is forced
to a screen's height.

## Shape and depth

Soft and round. `rounded-full` is what you press (buttons, chips, icon buttons, the
FAQ disc) and the circle (the photograph, the seal, the numbered steps, the avatar,
the rings). Fields take `rounded-md` (14px) — inputs and textareas alike — with the
buttons' heights (48 / 44 / 36px). Cards, tiles, panels and the map take
`rounded-xl` (28px); the large grounds — the opening, the bands (`Section ground`
other than `default`) and the footer — are sheets (`sheet`): `rounded-2xl` (40px),
8 / 12px from the window and from each other. Panels (the registration, the
testimonial form, the newsletter, the quote) are `rounded-2xl` too.

A card (`card`) is cream with a thin `line` and `shadow-card`: soft, wide, low. It
is for what you act on — a date, a form, an open question. Tiles, voices and notes
are cream with a line and no shadow; lists of things said in turn (the questions,
the agreements) are rows between lines. `shadow-overlay` is for what floats
(dialogs, menus, the admin's save bar). The forest and the sage carry no shadow. A
primary button glows a little in its own colour on hover.

## Motion

Short transitions answer interactions (a button rises 2px, arrows slide, header
links draw a line). The hero's ring turns once every 90 seconds; the breath circle
follows resonance breathing — 5.5 s in, 5.5 s out, an 11-second cycle — only when
started, and stops off screen, in a hidden tab or under reduced motion. The phone menu opens as a circle and its links
rise in (`rise`); the event title flies into its dock on a scroll timeline. Content
never waits for motion. Under reduced motion everything rests.

## Components

| Component                                         | Purpose                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Container`                                       | The 1200px width and the page's one edge (`--page-pad`)                                          |
| `Section` (`ground`, `space`)                     | A block: `default` / `alt` / `tint` / `dark`; every ground but the page is a rounded sheet       |
| `SectionHead` (`size`)                            | Eyebrow, title (`section` / `sub`), lead                                                         |
| `PageIntro` (`lead`, `media` slots)               | A sub-page's opening; without a photo the circle motif stands at its right                       |
| `Eyebrow`                                         | The section label: ember dot, accent text                                                        |
| `Button` (`variant`, `size`, `block`, `decorate`) | Round: `primary` (one per module), `secondary`, `danger`; 48 / 52px high                         |
| `TextLink`                                        | A quiet, underlined link with a small arrow                                                      |
| `Field`, `control()`, `FormStatus`                | Label, a rounded field, hint, field error; the form's result under its button                    |
| `EventSummary`                                    | One date: the seal (day and month) in its ring of seats, the date, four rows, the fitting action |
| `Fact` (`icon`)                                   | A tile: an icon in an accent disc, label, value in Fraunces, a note                              |
| `TestimonialList`                                 | One short featured quote behind an ember rule; the rest as cards with an initial; long ones fold |
| `Accordion`                                       | Questions as rounded cards; an accent disc whose plus turns into a minus                         |
| `Split`, `LinkList`, `Prose` (`width`)            | Head beside content; where-next rows; rich text (`measure` / `column`)                           |
| `ModeToggle`                                      | Day / night, in the footer and the phone menu                                                    |

**Header.** 72px: the mark in ember and the word mark in Fraunces; from `nav` five
links and one filled action; below `nav` the action and a menu button. Over the home
opening the bar is clear with light text; once the page moves it is linen over a
blur (`data-scrolled`). The phone menu is a native modal `<dialog>` on the forest,
opening as a circle from its button, its links in Fraunces.

**Footer.** A forest sheet on every page: the mark and word mark, one line about the
circle, navigation, contact, legal links and `ModeToggle`; the logo's ring stands
large and faint behind it.

## Compositions

- **Home.** The opening on the forest: eyebrow, statement (its key phrase in the
  accent), explanation, the main action and the link to the evening's course; beside
  it the photograph in a circle with the turning ring, the next date overlapping its
  edge (on phones under the text). Then four fact tiles (two columns on phones), the
  circle's topic beside the questions of the first round as a quiet list, the
  evening's four steps on a path (sand), the breath above the hills (forest), Markus
  (his quote in an ember-tint card signed with his avatar, beside his text), the
  five agreements as a numbered list beside their head, with the boundary note
  (sage), the voices, the FAQ, taking part (`#termine`, sand, invitation beside the
  date) and staying in touch (`#newsletter`, a panel with the form and the WhatsApp
  note beside it, parted by a line).
- **`/event`.** `PageIntro`, then every upcoming date as the same `EventSummary`
  beside the e-mail notification in a sage card; the FAQ; a where-next band.
- **Event page.** The date line and the title — "Männer**kreis**", its second half in
  the accent — which fly into the dock as the page scrolls; the place, the calendar
  and the registration on the forest, headed by the same ring of seats; the evening's description (sand) with its
  question and a note card; the map; where next. A past date offers no registration.
- **Personal page.** `PageIntro` with the rounded photograph, split heading/text
  sections, the FAQ, one closing invitation.
- **Testimonial form.** `PageIntro`, then the notes and the form in one card of
  ~672px (`max-w-form`).
- **Legal pages, 404.** `PageIntro` and the text in one ~720px column.
- **Admin.** The same tokens at night: forest grounds, rounded cards, ember for the
  one action.

## Rules

- Complete class strings only (no `bg-${x}`); variants are maps of full strings
  (`ui.ts`, `Section`, `SectionHead`). Conditional classes with `class:list`.
- Never pass a class that sets the same property a component already sets: add a
  prop instead (`SectionHead size`, `Button size`, `Prose width`, `control('xs')`,
  `NewsletterForm variant`).
- Scripts find elements by `data-*` attributes and switch states with them
  (`data-state`, `data-tone`, `data-scrolled`, `data-running`); styles read the same
  attributes through `data-[…]:` and `group-data-[…]:` variants.
- Arbitrary values are for one-off geometry (where the hero's ring and glow sit, the
  points on a ring at 120°); anything used twice becomes a token or a recipe.
- Allowed outside utilities, each with its reason in `theme.css`/`global.css`: font
  tokens, primitives, the surfaces, the reduced-motion floor, the scroll lock under a
  modal, the focus ring default, view-transition pseudo-elements, keyframes.
- Images on SSR pages are pre-sized files (`<img srcset>`); `<Image />` only on
  prerendered pages. The hero photograph is AVIF, eager and `fetchpriority="high"`.
- No layout shift: a date summary's lines are one line (`truncate`); titles measure
  in `em`, never `ch`. A narrow summary (container under 24rem) sets the seal beside
  its label and the date below, so "17. September 2026" never truncates.
- The ring of seats is drawn for 2–24 seats, taken first from the top, free ones in
  the accent; it is decorative (`aria-hidden`) because the seats row says it in words.
- Forms: labels always visible, placeholders never instead; a field's message under
  the field, the form's result under its button (`FormStatus`), never a toast;
  entries survive an error; success says what actually happened.
- Focus is always visible (2px accent outline, offset 3px). Buttons and fields are
  44–52px high; touch targets at least 44px.
