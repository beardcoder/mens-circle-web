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
  voices). No cards on public pages, not even for a date; the registration is a
  forest panel.
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

| File                             | Role                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`           | Tokens (`@theme`), primitives, variants, the three surfaces, keyframes, base rules. Shared.                                                  |
| `src/styles/global.css`          | Public entry: Tailwind (classes from `src/` only), theme, page transitions, the breath, the hero's ring, the opening and the scroll hooks.   |
| `src/styles/admin.css`           | Admin entry: Tailwind and theme; AdminLayout pins the dark mode (the forest at night).                                                       |
| `src/lib/ui.ts`                  | Class recipes: `button()`, `control()`, `link`, `label`, `fieldLabel`, `fieldHint`, `fieldError`, `formStatus`, `checkbox`, `card`, `panel`. |
| `src/lib/shared/event-status.ts` | The view model every date summary renders (`eventView`, `splitFee`).                                                                         |
| `src/lib/shared/seats.ts`        | How full a circle is (`seatFill`), shared by the date's bar and the registration panel; imports nothing.                                     |
| `src/components/ui/`             | The components built on them; `src/icons/` the line icons (24px grid, 1.7 stroke).                                                           |

## Colour

Primitives (`--p-*`) are plain hex values on `:root`; the roles pick them with
`light-dark()`, so day and night keep the same roles. The page follows the system
(Auto); `ModeToggle` offers Auto · Hell · Dunkel and pins a choice as `data-mode`,
set before first paint. Never a hex value in markup.

| Role            | Light                        | Night                 | Token                            | Use                                            |
| --------------- | ---------------------------- | --------------------- | -------------------------------- | ---------------------------------------------- |
| Page            | `#F6F2EA` linen              | `#111915`             | `ground`                         | the page                                       |
| Warm band       | `#ECE4D4` sand               | `#17201A`             | `ground-alt` (`surface-alt`)     | information that belongs together              |
| Quiet note      | `#E2E7D8` sage               | `#1C2720`             | `tint` (`surface-tint`)          | agreements, a hint beside the work             |
| Raised          | `#FFFCF6` cream              | `#1E2922`             | `raised`                         | the step circles, the hills, the admin's cards |
| Forest          | `#16221B` / raised `#213029` | `#0C130F` / `#18221C` | `surface-dark`                   | opening, breath, registration, menu, footer    |
| Text            | `#1B241E` / soft `#2E372F`   | `#ECE7DC`             | `fg`, `fg-soft`                  | titles / running text                          |
| Secondary text  | `#5A6255` moss               | `#A6AE9F`             | `fg-muted`                       | labels, notes, captions                        |
| Lines           | `#DDD5C5` / `#C8BFAC`        | `#2A362E` / `#3B4940` | `line`, `line-strong`            | quiet structure; never alone a control         |
| Control outline | `#7A8072`                    | `#7E8878`             | `line-bold`                      | inputs, secondary buttons (≥ 3:1)              |
| Accent          | `#9A421D` (hover `#953F1C`)  | `#F2A56C`             | `accent`, `accent-strong`        | links, labels, a highlighted word, free seats  |
| Accent tint     | `#F5DFCD`                    | `#3A2619`             | `accent-soft`                    | icon discs, the date seal, the FAQ disc        |
| Primary action  | `#B4532A` ember / `#953F1C`  | same                  | `fill`, `fill-strong`, `on-fill` | the one action of a module                     |
| Glow            | `#E8B65A`                    | same                  | `glow`                           | the warm point of the circle; never text       |

On the forest, `surface-dark` re-declares text (`#F2EDE3` bone, `#B4BBAD` muted),
accent (`#F2A56C`), lines (bone at 14 / 24 %) and the control outline (`#768379`).
`success` and `danger` are for real states only and always come with words.
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
| `text-hero`    | 44–88px   | the home statement                        |
| `text-page`    | 38–68px   | a sub-page's title, the breath line       |
| `text-section` | 34–60px   | a section's title                         |
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
buttons' heights (48 / 44 / 36px). The map, the calendar dialog and the admin's
cards take `rounded-xl` (28px), the registration panel and the photograph on the
personal page `rounded-2xl` (40px). The grounds are square and run from edge to edge.

A card (`card`) is cream with a thin `line` and `shadow-card`: soft, wide, low, and
only in the admin. On public pages everything is open: facts, questions,
agreements, FAQ and voices are rows or columns between thin lines; a quote stands
behind an ember rule; a note is a heading with its text. `shadow-overlay` is for
what floats (dialogs, menus, the admin's save bar). The forest and the sage carry
no shadow. A primary button glows a little in its own colour on hover.

## Motion

The page moves the way an evening starts, at the pace of an app: things arrive one
after the other, quickly, and settle. Opacity fades in on a gentle curve
(`--ease-fade`, 0.7 s below the opening, 0.9 s in it), focus comes from a light blur
on titles, movement follows Motion's springs without overshoot (visualDuration
0.65 s on scroll, the opening's sampled spring over 1.3 s, 1.9 s for the photo),
distances stay short (a word 0.3em, a piece 1.125rem) and things follow one another
at 0.055 s (words) or 0.07 s (what arrives together). Calm, never playful: no
bounce, no scale on text.

Performance comes first: smooth at 120fps, checked with Lighthouse and a frame
trace on every motion change (see "Lighthouse" below). Only opacity and transforms
move, so the compositor carries every frame. The one exception is the soft blur the
opening's title words come into focus from (CSS, light and 0.6 s, at load); a blur
is redrawn on the main thread every frame (about 16× a transform), so nothing that
moves while scrolling blurs. No parallax, no animated height. Fades start gently
(`--ease-fade`, `[0.33, 0, 0.2, 1]`), so they are seen; no script reads layout
before the page has settled (state at a scroll position comes from an
`IntersectionObserver`, never from `scrollY`); state flags go on the element that
needs them, never on `<html>` while the page moves (that restyles the whole page;
the boot script's flags are set before the first frame); and the opening never
waits for a script.

- The opening (`data-enter`, global.css, pure CSS from the first paint, because the
  title is the largest paint): the label, then the title word by word
  (`data-enter="words"`; `lib/shared/words.ts` wraps the words on the server with their
  index, so the lines break the same with and without motion), then the lead, the
  action and the next date at their `--enter-delay` (`afterWords()`), the seat bar
  filling after its line. The photo settles from a little larger (`settle`), the
  ring of the logo follows (`ring`). The springs are Motion's, sampled into
  `linear()` (`--ease-spring`, `--ease-spring-slow` in theme.css). The home opening
  and every sub-page opening (`PageIntro`) work this way. On an event page the date
  line and the title rise in first, then the lead and the registration panel; the
  dock's flight layer enters on the same beat, so the copies that fly the title
  show the same moment of it. The opening plays when the site is opened; a page
  reached from another page of the site arrives composed (see "Page transitions").
- Below it, CSS scroll-driven animations (global.css, "Motion: scroll"): each piece
  arrives as it comes into view, once, driven by the scroll itself
  (`animation-timeline: view()`, `animation-range: entry`): an element
  (`data-reveal`) or each child of a group (`data-reveal-group`: a section head's
  label, title and lead; a list's rows; a text's paragraphs, `Prose reveal`). Later
  children of a group start a little further into their entry, so what enters
  together follows top to bottom. Nothing is hidden up front: what is in view at
  load, or scrolled past, stands; a browser without scroll timelines, reduced motion
  and print show everything at once. The path between the steps draws itself in
  (`data-line`); a seat bar below the opening fills once in view (`data-seat-fill`).
  No script and no `motion` on this path.
- Every text on a page arrives this way, never a heading beside text that already
  stands: section heads, the intro's text and its questions, Markus's text and link,
  the steps and their close, the agreements, the voices and their link, the FAQ and
  its contact line, every date summary piece by piece, the newsletter, the event's
  story, note and map, the legal pages paragraph by paragraph. The footer is the
  frame and stands.
- No parallax: things arrive once and then stand. The event title flying into its
  dock is the other scroll-linked piece.
- FAQ (`AccordionItem`) as a FLIP: the layout changes once, at the press; then what
  follows the item (its siblings, the sections below, the footer) slides from where
  it stood while a clip uncovers the answer on the same spring, so their edges meet,
  and the text rises in behind. Closing runs it backwards, the marker turns back at
  once (`data-closing`, the `item-open:` variant). Each item carries its top line
  and the closing line is its own element, so lines move instead of jumping. Under
  reduced motion the native toggle stays.
- The bottom bar on phones (`ActionBar`) glides up on a spring once the opening's
  action has gone, its date and action a beat behind; it slips away faster than it
  came. The registration form is in the page from the first frame; its answer
  replaces the fields in place.
- Loops that never change state stay in CSS: the glow breathes on the 11-second
  cycle (`data-glow`), the ring turns; both pause once the opening is out of view
  (`data-offscreen`, Hero.astro), since a running animation is serviced every frame.

### Page transitions

Native cross-document view transitions (global.css, "Page transitions"), like an
app's navigation stack. Going forward, the next page comes in from the right while
the current one drifts left and fades; going back mirrors it. The page that leaves
fades quickly (0.18 s), the one that comes fades in a beat later (0.32 s) and slides
3.5rem on Motion's spring (0.52 s), so the two never sit on top of each other at
half strength. The frame holds still: the bar (`site-header`) stays in place while
the page moves under it; leaving through the open phone menu, the menu
(`nav-menu`) fades away over the next page and the page that lay under it is never
shown.

A page that arrives this way is composed, like an app's next screen: no opening; what
lies below the screen arrives as it scrolls into view, like everywhere. A page
reached again through the history stands as it was left.

Smooth on a phone means the main thread stays free while the page moves, because
Chrome updates a transition on it every frame:

- Only opacity and translation move, and no group animates its size (that runs on
  the main thread), since nothing named changes place.
- Names go on the elements themselves, only while a transition runs (`pageswap`,
  `pagereveal`): a view-transition-name makes its element a backdrop root (the bar
  would lose its blur), and a selector that switched names for the whole page would
  restyle every element as a transition starts and ends.
- The first frame waits until the page is parsed up to the footer
  (`<link rel="expect" href="#footer" blocking="render">`, only when arriving from
  the site), so the page is laid out once before it moves.
- The upright fonts load while the page parses (Layout.astro), not at the first
  layout; otherwise they swap in a frame later and the page is laid out again.
- Nothing restyles the whole page on its own: the bar over the opening is an
  attribute (`data-over-hero`), not `body:has()` (that reacts to every node the
  parser or an island adds); scripts write an attribute on `<html>` only when it
  changes (`ModeToggle`); the event dock measures the page only once the
  transition has finished (`document.activeViewTransition`).

Measured with Chrome at a 6× slower CPU, the work on the main thread while the page
moves fell from about 170 ms of style to about 30 ms (home → `/event`) and from
about 280–430 ms to about 40–50 ms (`/event` → a date).

The boot script in `Layout.astro` names the direction as the page is revealed
(`pagereveal`; `forward`, `back`, `menu` as view-transition types) and, while the
page parses, how it arrived (`data-arrival`: `next` from another page of the site,
`return` through the history; from the Navigation API, else the navigation timing
and the referrer). A browser without types cross-fades (`plus-lighter`, one
duration, linear), and so does reduced motion; a browser without cross-document
transitions simply loads the page, composed all the same.

Third-party scripts load `async`, so nothing queues in front of the
page's own.

### Lighthouse

Run it against a production build (`bun run build`, then the server on a disposable
database) for the home page on mobile and desktop and for any page whose motion
changed: `bunx lighthouse <url> --only-categories=performance,accessibility,best-practices,seo`
(add `--preset=desktop`). Hold: CLS 0, no forced reflow ("Forced reflow" insight
empty), no non-composited animations beyond the accepted blur on the opening's
title words, the LCP element's render delay well under
half a second. Locally the server does not compress (the proxy does in
production), so the render-blocking stylesheet weighs more in the simulated
mobile score than it does live.

Short transitions answer interactions (a button rises 2px and settles as it is
pressed, arrows slide and nudge on a press, the FAQ disc gives a little under the
finger, header links draw a line). The hero's ring turns once every 90 seconds; the breath circle
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
  (`#termine`, sand, invitation beside the next date) and staying in touch
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
