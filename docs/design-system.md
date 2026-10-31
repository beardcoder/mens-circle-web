# Design system

## Idea — a fire circle at the edge of the forest

A men's circle meets in the evening, sits in a ring and listens. The site looks like
that evening: deep forest green for what draws you in, the warm ember of the logo
for the one thing to do, linen daylight for reading. The circle is the one motif —
the photograph in a ring, three warm points on it (the three figures of the logo),
the date in its seal, numbered steps on a path, the breath above the hills of
the Bavarian Forest. Shapes are soft and round.

Four principles: make the next step visible, group what belongs together, keep
reading lines short, use the same component for the same function. Everything is
fast: two font files (~37 kB), one stylesheet, images sized at build time.

## Stance — hold the space, don't perform

The page acts the way a circle leader does. Leading a circle means holding the
space instead of performing: listening, explaining the frame, asking for consent,
then stepping back. Translated into design:

- **Quiet.** Few effects, much air, one action per module. Grounds run from edge
  to edge; content stands on them, not in boxes. Lists between lines rather than
  cards (the facts, the questions of the first round, the agreements, the FAQ, the
  voices). A card only for what you act on: a date, the registration.
- **Safe and clear.** The frame is visible before anyone comes: how an evening
  runs, what we agree on, that every exercise is an offer, that "no" is always a
  good answer, that it is no therapy. Nothing is hidden behind a click that a
  hesitant visitor needs to decide.
- **Grounded.** Nature, body and breath, never lofty: forest, hills, fire and the
  breath as concrete things, no cosmic imagery, no gradients for their own sake.
- **The circle.** The ring is the space everyone shares; under every date a slim
  bar shows how full the circle already is.
- **Open to every man.** Language that excludes no one (age, origin, faith, with
  whom you share your life); "du", plain German, no jargon and no "brother" tone.

## Voice

German, "du", short sentences, first person where Markus speaks. Describe what
happens, not what it should make you feel. Name the frame in plain words: the five
agreements are Vertraulichkeit, Ehrlichkeit, Annehmen statt bewerten, Von sich
sprechen and Respekt (after the training's CHAOS: confidentiality, honesty,
acceptance, ownership, sacred). The evening's arc is Ankommen, die erste Runde,
Teilen und zuhören, Abschlussrunde. Every invitation to take part comes with the
permission not to. No promises of healing; the circle is no therapy and says so.

What reads as written by a machine stays out: no dash for effect (a dash only where
a comma or full stop cannot do), no slogan contrasts ("nicht X, sondern Y", "Ich
führe, aber ich führe nichts vor"), no lists of three for rhythm, no therapy phrases
("das darf so sein", "was sich zeigt", "was dich trägt"), no "Raum", "Reise" or
"Bogen" as images. Say a thing once per page: "keine Vorerfahrung" belongs in the
facts and the FAQ, not in every section.

## Files

| File                      | Role                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`    | Tokens (`@theme`), primitives, variants, the three surfaces, keyframes, base rules. Shared.                                                  |
| `src/styles/global.css`   | Public entry: Tailwind (classes from `src/` only), theme, view transitions, the breath and the hero's turning ring.                          |
| `src/styles/admin.css`    | Admin entry: Tailwind and theme; AdminLayout pins the dark mode (the forest at night).                                                       |
| `src/lib/ui.ts`           | Class recipes: `button()`, `control()`, `link`, `label`, `fieldLabel`, `fieldHint`, `fieldError`, `formStatus`, `checkbox`, `card`, `panel`. |
| `src/lib/event-status.ts` | The view model every date summary renders (`eventView`, `splitFee`).                                                                         |
| `src/lib/seats.ts`        | How full a circle is (`seatFill`), shared by the date's bar and the registration panel; imports nothing.                                     |
| `src/components/ui/`      | The components built on them; `src/icons/` the line icons (24px grid, 1.7 stroke).                                                           |

## Colour

Primitives (`--p-*`) are plain hex values on `:root`; the roles pick them with
`light-dark()`, so day and night keep the same roles. The page follows the system
(Auto); `ModeToggle` offers Auto · Hell · Dunkel and pins a choice as `data-mode`,
set before first paint. Never a hex value in markup.

| Role            | Light                        | Night                 | Token                            | Use                                           |
| --------------- | ---------------------------- | --------------------- | -------------------------------- | --------------------------------------------- |
| Page            | `#F6F2EA` linen              | `#111915`             | `ground`                         | the page                                      |
| Warm band       | `#ECE4D4` sand               | `#17201A`             | `ground-alt` (`surface-alt`)     | information that belongs together             |
| Quiet note      | `#E2E7D8` sage               | `#1C2720`             | `tint` (`surface-tint`)          | agreements, a hint beside the work            |
| Card            | `#FFFCF6` cream              | `#1E2922`             | `raised`                         | the date card, fields                         |
| Forest          | `#16221B` / raised `#213029` | `#0C130F` / `#18221C` | `surface-dark`                   | opening, breath, registration, menu, footer   |
| Text            | `#1B241E` / soft `#2E372F`   | `#ECE7DC`             | `fg`, `fg-soft`                  | titles / running text                         |
| Secondary text  | `#5A6255` moss               | `#A6AE9F`             | `fg-muted`                       | labels, notes, captions                       |
| Lines           | `#DDD5C5` / `#C8BFAC`        | `#2A362E` / `#3B4940` | `line`, `line-strong`            | quiet structure; never alone a control        |
| Control outline | `#7A8072`                    | `#7E8878`             | `line-bold`                      | inputs, secondary buttons (≥ 3:1)             |
| Accent          | `#9A421D` (hover `#953F1C`)  | `#F2A56C`             | `accent`, `accent-strong`        | links, labels, a highlighted word, free seats |
| Accent tint     | `#F5DFCD`                    | `#3A2619`             | `accent-soft`                    | icon discs, the date seal, the FAQ disc       |
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
| `text-sub`     | 22–30px   | subheadings, list titles, a fact's value  |
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

One content width, 1200px, and **one edge**: the content sits 28 / 40 / 56px from
the window (`gutter`, `Container`) in every section, and the header shares it. The
grounds — the opening, the bands and the footer — run from edge to edge.

Content stands on its ground, with plenty of air; a second part is parted by space,
rarely by a line, never by a box. The dates are open too: no card, the facts as small
columns and a seat bar. Two paddings remain: `card` 24 / 28 / 32px (the calendar
dialog), `panel` 28 / 40 / 48px (the registration: beside the intro it runs out to
the window's right edge with a rounded inner corner; below `lg` it is a forest band
from edge to edge).

Space per width on `:root`: `py-section` 88 → 144px, `py-band` 56 → 80px, `group`
40 → 64px (an explanation to the module after it), `grid` 32 → 48px (column gap).
An eyebrow stands 16px above its title. Breakpoints: `sm` 36rem, `md` 48rem, `lg`
64rem, `nav` 68.75rem (the header shows its links), `xl` 80rem. No section is forced
to a screen's height.

## Shape and depth

Soft and round. `rounded-full` is what you press (buttons, chips, icon buttons, the
FAQ disc) and the circle (the photograph, the seal, the numbered steps, the avatar,
the rings). Fields take `rounded-md` (14px) — inputs and textareas alike — with the
buttons' heights (48 / 44 / 36px). The date card and the map take `rounded-xl`
(28px), the registration panel and the photograph on the personal page
`rounded-2xl` (40px). The grounds are square and run from edge to edge.

A card (`card`) is cream with a thin `line` and `shadow-card`: soft, wide, low, and
only for what you act on (a date). Everything else is open: facts, questions,
agreements, FAQ and voices are rows or columns between thin lines; a quote stands
behind an ember rule; a note is a heading with its text. `shadow-overlay` is for
what floats (dialogs, menus, the admin's save bar). The forest and the sage carry
no shadow. A primary button glows a little in its own colour on hover.

## Motion

The page moves the way an evening starts: things arrive one after the other and
settle. Soft rather than snappy: opacity eases out on one long curve
(`--ease-out`, `[0.22, 1, 0.36, 1]`, about 1.1 s), movement follows Motion's
springs without overshoot (visualDuration 1.1 s, 1.6 s for the photo), distances
stay short (a word 0.3em, a section 1.25rem) and things follow one another at
0.07 s (words) or 0.12 s (a group). A calm site, not a playful one.

Performance comes first, checked with Lighthouse on every motion change (see
"Lighthouse" below): only opacity and transforms move, so everything runs on the
compositor (no blur, no height except the FAQ on a press, no parallax); no script reads layout
before the page has settled (state at a scroll position comes from an
`IntersectionObserver` on a sentinel, never from `scrollY`); and the opening never
waits for a script.

- The opening (`data-enter`, global.css, pure CSS from the first paint, because the
  title is the largest paint): the label, then the title word by word
  (`data-enter="words"`; `lib/words.ts` wraps the words on the server with their
  index, so the lines break the same with and without motion), then the lead, the
  action and the next date at their `--enter-delay` (`afterWords()`). The photo
  settles from a little larger (`settle`), the ring of the logo follows (`ring`).
  The springs are Motion's, sampled into `linear()` (`--ease-spring`,
  `--ease-spring-slow` in theme.css). The home opening and every sub-page opening
  (`PageIntro`) work this way.
- Below it, Motion (motion.dev; `components/Motion.astro`, `animate` from
  `motion/mini` with `inView`, `scroll`, `spring`, about 9 kB). On scroll (`inView`,
  once): a section rises in as it enters the view (`data-reveal`); a group's
  children follow one another (`data-reveal-group`; every section head is one), and
  the path between the steps draws itself in after the circles (`data-line`). The
  seat bar fills to the taken seats (`data-seat-fill`); in the opening it waits for
  its date line.
- No parallax: nothing moves with the scroll itself; things arrive once and then
  stand. The event title flying into its dock is the one scroll-linked piece.
- Every page reveals its sections the same way: section heads, `Prose reveal`
  (text sections, legal pages, the close under the steps), `LinkList`,
  `ValueItems`, the newsletter's two columns, the event's story, its "Du kannst
  erst einmal zuhören" note and its map. On an event page the lower part of the
  intro (lead, links, the registration panel) rises in at load in CSS; the date
  and title stay still, because the dock flies them.
- FAQ (`AccordionItem`): the answer unfolds on a spring and its text rises in
  behind it; it folds shut a little faster, the marker turns back at once
  (`data-closing`, the `item-open:` variant), and a second press turns the motion
  around mid-way. Under reduced motion the native toggle stays.
- The bottom bar on phones (`ActionBar`) glides up on a spring once the opening's
  action has gone, its date and action a beat behind; it slips away faster than it
  came.
- Loops that never change state stay in CSS: the glow breathes on the 11-second
  cycle (`data-glow`), the ring turns.

The boot script in `Layout.astro` sets `data-motion` on `<html>` only when motion is
allowed; `global.css` keeps the scroll hooks hidden under it until they move. If the
script has not started within three seconds the flag is dropped and everything
stands. Without the flag (reduced motion, no script, print) nothing hides. Third-party
scripts load `async`, so nothing queues in front of the page's own.

### Lighthouse

Run it against a production build (`bun run build`, then the server on a disposable
database) for the home page on mobile and desktop and for any page whose motion
changed: `bunx lighthouse <url> --only-categories=performance,accessibility,best-practices,seo`
(add `--preset=desktop`). Hold: CLS 0, no forced reflow ("Forced reflow" insight
empty), no non-composited animations, the LCP element's render delay well under
half a second. Locally the server does not compress (the proxy does in
production), so the render-blocking stylesheet weighs more in the simulated
mobile score than it does live.

Short transitions answer interactions (a button rises 2px, arrows slide, header
links draw a line). The hero's ring turns once every 90 seconds; the breath circle
follows resonance breathing (5.5 s in, 5.5 s out) only when started, and stops off
screen, in a hidden tab or under reduced motion. The phone menu opens as a circle
and its links rise in (`rise`); the event title flies into its dock on a scroll
timeline. On phones the home page keeps the next date and its action in a bottom bar
(`ActionBar`) once the opening's action has scrolled away; it steps back at the
dates and the footer. Under reduced motion everything rests.

## Components

| Component                                         | Purpose                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Container`                                       | The 1200px width and the page's one edge (`px-gutter`)                                                 |
| `Section` (`ground`, `space`)                     | A block: `default` / `alt` / `tint` / `dark`; every ground runs from edge to edge                      |
| `SectionHead` (`size`)                            | Eyebrow, title (`section` / `sub`), lead                                                               |
| `PageIntro` (`lead`, `media` slots)               | A sub-page's opening; without a photo the circle motif stands at its right                             |
| `Eyebrow`                                         | The section label: ember dot, accent text                                                              |
| `Button` (`variant`, `size`, `block`, `decorate`) | Round: `primary` (one per module), `secondary`, `danger`; 48 / 52px high                               |
| `TextLink`                                        | A quiet, underlined link with a small arrow                                                            |
| `Field`, `control()`, `FormStatus`                | Label, a rounded field, hint, field error; the form's result under its button                          |
| `EventSummary`                                    | One date, open on its ground: the seal, the date, the facts as small columns, the seat bar, the action |
| `Fact` (`icon`)                                   | An icon in an accent disc, label, value in Fraunces, a note; a row, on the desktop a column            |
| `TestimonialList`                                 | One short featured quote behind an ember rule; the rest under a line each; long ones fold              |
| `Accordion`                                       | Questions as rows between lines; an accent disc whose plus turns into a minus                          |
| `Split`, `LinkList`, `Prose` (`width`)            | Head beside content; where-next rows; rich text (`measure` / `column`)                                 |
| `ModeToggle`                                      | Auto · Hell · Dunkel (Auto follows the system), in the footer and the phone menu                       |

**Header.** 72px: the mark in ember and the word mark in Fraunces; from `nav` five
links and one filled action; below `nav` the action and a menu button. Over the home
opening the bar is clear with light text; once the page moves it is linen over a
blur (`data-scrolled`). The phone menu is a native modal `<dialog>` on the forest,
opening as a circle from its button, its links in Fraunces.

**Footer.** A forest band on every page: the mark and word mark, one line about the
circle, navigation, contact, legal links and `ModeToggle`; the logo's ring stands
large and faint behind it.

## Compositions

- **Home.** The opening on the forest: eyebrow, statement (its key phrase in the
  accent), explanation, the main action and the link to the evening's course; beside
  it the photograph in a circle with the turning ring, the next date overlapping its
  edge (on phones under the text). Then the four facts between lines (columns with
  rules on the desktop, rows below), the circle's topic beside the questions of the
  first round as a quiet list, the evening's four steps on a path (sand), the breath
  above the hills (forest), Markus (his quote behind an ember rule, signed with his
  avatar, beside his text), the five agreements as a numbered list beside their
  head, with the boundary note (sage), the voices, the FAQ, taking part
  (`#termine`, sand, invitation beside the date card) and staying in touch
  (`#newsletter`, the form and the WhatsApp note beside it, parted by a line).
- **`/event`.** `PageIntro`, then every upcoming date as the same `EventSummary`
  beside the e-mail notification, parted by a line; the FAQ; a where-next band.
- **Event page.** The date line and the title — "Männer**kreis**", its second half in
  the accent — which fly into the dock as the page scrolls; the place, the calendar
  between lines and the registration on the forest (a band below `lg`), headed by
  the same seat bar; the evening's description (sand) with its question and a
  note under a line; the map; where next. A past date offers no registration.
- **Personal page.** `PageIntro` with the rounded photograph, split heading/text
  sections, the FAQ, one closing invitation.
- **Testimonial form.** `PageIntro`, then the notes and the form in one column of
  ~672px (`max-w-form`), on the page.
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
- The seat bar (`SeatBar`) is decorative (`aria-hidden`): the line under it says the
  seats in words.
- Forms: labels always visible, placeholders never instead; a field's message under
  the field, the form's result under its button (`FormStatus`), never a toast;
  entries survive an error; success says what actually happened.
- Focus is always visible (2px accent outline, offset 3px). Buttons and fields are
  44–52px high; touch targets at least 44px.
