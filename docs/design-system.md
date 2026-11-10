# Design system

## Idea: the circle of chairs

A men's circle meets in the evening, sits in a ring and listens. The site looks like
that evening: a centre, things turned towards each other, much air between them.
Poster-sized type where the site invites, calm reading where it explains. The
forest and the moss for what draws you in and what is spoken in the circle, warm
paper for reading, the ember of the logo for the one thing to do and a spark of
gold for what stands large on the dark grounds.

The grid is twelve columns and one edge. Four moves break it, and only these
(see "The four moves"): the margin column, the overlap, the bleed and the poster
word. The circle is the one motif, in four forms: the mark, the seat ring (every
chair of an evening on a ring), the stamp and the index number.

The living reference is `/styleguide` (noindex): it reads `theme.css` through
`lib/brand/theme-tokens.ts` and shows the real components, so it cannot drift.
Everything that leaves the site (flyers, posts, preview images, logo files, token
exports) is in [docs/brand/README.md](brand/README.md).

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

| File                            | Role                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`          | Tokens (`@theme`), primitives, variants, the surfaces, the bleed utilities, keyframes, base rules. Shared. |
| `src/styles/global.css`         | Public entry: Tailwind, theme, print of a page, page transitions, the FAQ, opening and scroll motion.      |
| `src/styles/admin.css`          | Admin entry: Tailwind and theme; AdminLayout pins the dark mode.                                           |
| `src/styles/print.css`          | Brand templates entry (`src/components/print`, `src/pages/brand`), container units, no page margin.        |
| `src/lib/ui.ts`                 | Class recipes: `button()`, `control()`, `link`, `label`, field and form states, `card`, `panel`, `margin`. |
| `src/lib/brand/theme-tokens.ts` | Parses `theme.css` into tokens for the styleguide and the export.                                          |
| `src/lib/brand/notes.ts`        | German notes per token for the styleguide.                                                                 |
| `src/lib/shared/seats.ts`       | How full a circle is (`seatFill`) and where its chairs sit on the ring (`seatDots`).                       |
| `src/components/ui/`            | Components on the recipes (`Section`, `SectionHead`, `Poster`, `Index`, `Marginal`, `Button`, `Field` …).  |
| `src/components/brand/`         | The motifs, shared by site and print: `SeatRing`, `Stamp`, `Lockup`, `Qr`.                                 |
| `src/components/styleguide/`    | What only the styleguide needs: `Swatch`, `TypeSpecimen`, `Example`, `DoDont`.                             |

## Colour

Primitives (`--p-*`) are plain hex values on `:root`; the roles pick them with
`light-dark()`, so day and night keep the same roles. The page follows the system
(Auto); `ModeToggle` offers Auto · Hell · Dunkel and pins a choice as `data-mode`,
set before first paint. Never a hex value in markup.

| Role            | Light                        | Night                 | Token                            | Use                                              |
| --------------- | ---------------------------- | --------------------- | -------------------------------- | ------------------------------------------------ |
| Page            | `#F4EEE2` paper              | `#0F1410`             | `ground`                         | the page                                         |
| Warm band       | `#E6DAC4` sand               | `#1D2019`             | `ground-alt` (`surface-alt`)     | what belongs together: facts, course, dates      |
| Raised          | `#FFFCF6` cream              | `#262B23`             | `raised`                         | fields, the QR square, the admin's cards         |
| Moss            | `#2C3A30`                    | `#1A2A20`             | `surface-moss`                   | what is spoken in the circle: agreements, voices |
| Forest          | `#16221B` / raised `#213029` | `#0C130F` / `#18221C` | `surface-dark`                   | opening, registration, menu, last band, footer   |
| Text            | `#1B241E` / soft `#2E372F`   | `#ECE7DC`             | `fg`, `fg-soft`                  | titles / running text                            |
| Secondary text  | `#565E51` moss grey          | `#A6AE9F`             | `fg-muted`                       | labels, notes, captions                          |
| Lines           | `#D8CDB8` / `#C2B59C`        | `#2B3029` / `#3D4339` | `line`, `line-strong`            | quiet structure; never alone a control           |
| Control outline | `#767C6E`                    | `#7E8878`             | `line-bold`                      | inputs, secondary buttons (≥ 3:1)                |
| Accent          | `#9A421D`                    | `#F2A56C`             | `accent`, `accent-strong`        | links, labels, a highlighted word, index numbers |
| Primary action  | `#B4532A` ember / `#953F1C`  | same                  | `fill`, `fill-strong`, `on-fill` | the one action of a module, a taken chair        |
| Spark           | `#E8B65A`                    | same                  | `spark`                          | poster words and numbers on forest and moss      |

On the forest and the moss the surfaces re-declare text (bone `#F2EDE3`, muted
`#B4BBAD`), accent (`#F2A56C`), lines (bone at 14–28 %) and the control outline
(forest `#768379`, moss `#8A968A`). The spark is never text on paper or sand.
`success` and `danger` are for real states only and always come with words. Every
text pair holds at least 4.5:1 on every ground in both modes, every control line at
least 3:1 (`tests/contrast.test.ts`, pair by pair). Check any new pair in both modes.

## Type

`font-display` is Fraunces, variable in weight (500–700) and optical size (9–144),
one file of ~60 kB in the repo (`src/assets/fonts/`). The optical size follows the
size by itself, so a poster word gets the high-contrast cut and a date the sturdy
one. Titles are 500, the hero, page titles, index numbers and poster words 600.
`font-sans` is Figtree (variable, 400–700): running text, navigation, forms, data.
A highlighted phrase in a title (`<em>`) turns the accent (the spark on the forest)
and stays upright.

| Token           | Size     | Use                                              |
| --------------- | -------- | ------------------------------------------------ |
| `text-poster`   | 72–216px | one poster word or number (`Poster`)             |
| `text-hero`     | 48–104px | the home statement                               |
| `text-index`    | 48–104px | an index number in the margin (`Index`)          |
| `text-page`     | 44–96px  | a sub-page's title, an event title               |
| `text-section`  | 36–72px  | a section's title, the one featured voice        |
| `text-sub`      | 22–30px  | subheadings, list titles, a fact's value, a date |
| `text-quote`    | 24–34px  | one short quote                                  |
| `text-xl`       | 18–22px  | FAQ questions, the questions of the first round  |
| `text-lg`       | 18–21px  | a lead                                           |
| `text-md`       | 17–19px  | running text (the body)                          |
| `text-base`     | 16px     | controls, buttons, data                          |
| `text-sm`/`xs`  | 14/13px  | labels, hints, captions / the small print        |
| `text-marginal` | 14px     | a note in the margin column (`Marginal`)         |

Titles tighten their tracking as they grow (−1 % to −5 %). Labels are sentence
case: `Eyebrow` in the accent after a small ember dot, data labels (`label`) in the
secondary colour. Running text stays on `max-w-measure` (~62 characters).

## Space and grid

One content width, 1200px, and one edge: the content sits 28 / 40 / 56px from the
window (`gutter`, `Container`) in every section, and the header shares it. The
grounds run from edge to edge. Space per width on `:root`: `py-section` 88 → 144px,
`py-band` 56 → 80px, `group` 40 → 64px, `grid` 32 → 48px (column gap), `overlap`
40 / 64 / 96px. Breakpoints: `sm` 36rem, `md` 48rem, `lg` 64rem, `nav` 68.75rem,
`xl` 80rem. No section is forced to a screen's height.

### The four moves

The grid breaks in these four ways only, each at most once per section, so the
page stays alive and calm. The styleguide shows each with its rules.

1. **Margin column** (`margin` in `lib/ui.ts`): from `lg` a margin on columns 1–3
   for index numbers, labels and notes, the content on 4–12 (`margin.reading` 4–10
   for running text). A title may start in the margin and cross into the content
   (`margin.cross`, 1–10). Always on the left; below `lg` it stacks, margin first.
   Facts, intro, course, voices, FAQ, the personal page's sections.
2. **Overlap** (`overlap` token: `-bottom-overlap`, `-left-overlap` …): an element
   crosses an edge towards the centre, always on a ground of its own (a disc, a
   panel). The seat ring over the hero's photograph, the quote crossing Markus's
   ring.
3. **Bleed** (`bleed-l`, `bleed-r`, `bleed-x`; `--spacing-bleed` is the way from the
   content's edge to the window's): a photograph, a ring or the stamp runs out of
   the window. The side changes down the page (the hero's photo right, Markus's
   ring right after a left-hand intro, the stamp right at the end). Sections clip
   horizontally (`Section`), so a bleed never scrolls.
4. **Poster word** (`Poster`, `text-poster`): one word or number as large as a
   poster, as the title ("Dabei sein.") or quietly behind content (`tone="ghost"`,
   8 % of the text colour, hidden from assistive technology). At most one per screen.

Never: staircases of offset blocks, rotation (only the stamp turns), shadows, boxes
around content, text over a photograph.

## Shape and depth

Soft and round. `rounded-full` is what you press (buttons, chips, icon buttons, the
FAQ disc) and the circle (photographs of people, the seat ring, the stamp, the
avatar). Fields take `rounded-md` with the buttons' heights (48 / 44 / 36px). The
map and dialogs take `rounded-xl`, the registration panel `rounded-2xl`. The grounds
are square and run from edge to edge. On public pages nothing is boxed: facts,
questions, agreements, steps, FAQ and voices are rows between thin lines.
`shadow-overlay` is for what floats; nothing else casts a shadow.

## Images

Two forms only: a person in a circle, a place (forest, evening, the room) in a
rectangle cut by the window or the sheet. One form per section; warm, natural
light; captions as margin notes. No staged group shots, no stock, no recognisable
participants without their explicit consent, no text on a photograph.

## Motion

The page moves the way an evening starts, at the pace of an app: things arrive one
after the other, quickly, and settle. Opacity fades in on a gentle curve
(`--ease-fade`, 0.7 s below the opening, 0.9 s in it), focus comes from a light blur
on titles, movement follows springs without overshoot (sampled into `linear()`:
the opening's over 1.3 s, 1.9 s for the photo; scroll reveals follow the scroll),
distances stay short (a word 0.3em, a piece 2rem) and things follow one another
at 0.055 s (words) or 0.07 s (what arrives together). Calm, never playful: no
bounce, no scale on text.

Performance comes first: smooth at 120fps, checked with Lighthouse and a frame
trace on every motion change (see "Lighthouse" below). Only opacity and transforms
move, so the compositor carries every frame. The one exception is the soft blur the
opening's title words come into focus from (CSS, light and 0.6 s, at load); a blur
is redrawn on the main thread every frame (about 16× a transform), so nothing that
moves while scrolling blurs. Depth is tied to the scroll and listed below ("Depth"); nothing else drifts, and no height animates except the FAQ's native unfolding. Fades start gently
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
  action and the next date at their `--enter-delay` (`afterWords()`), the taken
  chairs of the seat ring filling in one after the other. The photo settles from a little larger (`settle`), the
  ring of the logo follows (`ring`). The springs are Motion's, sampled into
  `linear()` (`--ease-spring`, `--ease-spring-slow` in theme.css). The home opening
  and every sub-page opening (`PageIntro`) work this way. On an event page the date
  line and the title rise in first, then the lead and the registration panel. Once the
  title has scrolled under the bar, a dock with title and date fades and slides in
  below the bar (`EventDock`, one observer, opacity and translation). The opening plays on every page load.
- Below it, CSS scroll-driven animations (global.css, "Motion: scroll"): each piece
  arrives as it comes into view, once, driven by the scroll itself
  (`animation-timeline: view()`, `animation-range: entry`): an element
  (`data-reveal`) or each child of a group (`data-reveal-group`: a section head's
  label, title and lead; a list's rows; a text's paragraphs, `Prose reveal`). Later
  children of a group start a little further into their entry, so what enters
  together follows top to bottom. Nothing is hidden up front: what is in view at
  load, or scrolled past, stands; a browser without scroll timelines, reduced motion
  and print show everything at once. The taken chairs of a seat ring below the opening fill in once in view
  (`data-seat-dot`); the stamp turns a little as it passes (`data-stamp-turn`, the one
  element that turns, driven by the scroll, so it costs nothing out of view).
  No script and no `motion` on this path.
- Every text on a page arrives this way, never a heading beside text that already
  stands: section heads, the intro's text and its questions, Markus's text and link,
  the steps and their close, the agreements, the voices and their link, the FAQ and
  its contact line, every date summary piece by piece, the newsletter, the event's
  story, note and map, the legal pages paragraph by paragraph. The footer is the
  frame and stands.
- Depth (global.css, "Motion: scroll"; scroll-linked, so at rest whenever the page
  rests, and each on an element of its own beside the one that arrives): the opening
  leaves in layers (`--hero` view timeline: its text goes ahead, `data-hero-text`,
  never dimmed; the photograph falls behind and comes a little closer,
  `data-hero-photo`; the ring's point travels on, `data-hero-orbit`); an index number
  trails its row (`data-index`); the poster word of the dates slides in from the side
  (`data-drift`); Markus's ring opens (`data-ring-open`). Transforms and opacity only.
- A hovering pointer carries a soft firelight across the opening (`data-ember`,
  Hero.astro): one `translate` per pointer event, eased by a CSS transition, no
  layout read; not on touch, not under reduced motion.
- Things arrive once and then stand; beyond the depth above only the stamp turns with
  the scroll.
- FAQ (`AccordionItem`): a native `<details>`; where `interpolate-size` exists its
  `::details-content` transitions from height 0 to `auto` in 0.32 s (global.css,
  "FAQ"), and the marker turns (`item-open:` variant). Keyboard, find-in-page and
  screen readers work as with any `<details>`. Elsewhere, and under reduced motion,
  it toggles at once. No script.
- The bottom bar on phones (`ActionBar`) glides up on the spring curve once the
  opening's action has gone and slips away again (a CSS transition on
  `data-visible`, at once under reduced motion). There is no reading-progress bar,
  and the back-to-top link shows on the desktop only. The registration form is in the page from the first frame; its answer
  replaces the fields in place.
- Loops that never change state stay in CSS: the glow breathes on the 11-second
  cycle (`data-glow`), the ring turns; both pause once the opening is out of view
  (`data-offscreen`, Hero.astro), since a running animation is serviced every frame.

### Page transitions

Native cross-document view transitions (global.css, "Page transitions"): the two
pages cross-fade (`plus-lighter`, 220 ms, linear, one duration for both halves, so
their opacities always sum to 1 and nothing sags grey). Only opacity moves, on the
compositor; no group animates and nothing is named. Every page plays its own opening
when it arrives. A browser without cross-document transitions simply loads the
page. The boot script in the head sets only the colour mode before the first paint.
Third-party scripts load `async`, so nothing queues in front of the page's own.

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
finger, header links draw a line). The hero's ring turns once every 90 seconds and rests off screen and under reduced
motion. The phone menu opens as a circle
and its links rise in (`rise`); the event dock fades in once the title is gone. On phones the home page keeps the next date and its action in a bottom bar
(`ActionBar`) once the opening's action has scrolled away; it steps back at the
dates and the footer. Under reduced motion everything rests.

## Components

| Component                                         | Purpose                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Container`                                       | The 1200px width and the page's one edge (`px-gutter`)                                               |
| `Section` (`ground`, `space`)                     | A block: `default` / `alt` / `moss` / `dark`, edge to edge, clipping what bleeds                     |
| `SectionHead` (`size`)                            | Eyebrow, title (`section` / `sub`), lead; with `margin.cross` it crosses into the content            |
| `PageIntro` (`lead`, `media` slots)               | A sub-page's opening; a photograph bleeds right, without one the stamp stands there                  |
| `Poster`, `Index`, `Marginal`                     | The poster word, the index number, the margin note                                                   |
| `Eyebrow`                                         | The section label: ember dot, accent text                                                            |
| `Button` (`variant`, `size`, `block`, `decorate`) | Round: `primary` (one per module), `secondary`, `danger`                                             |
| `TextLink`                                        | A quiet, underlined link with a small arrow                                                          |
| `Field`, `control()`, `FormStatus`                | Label, a rounded field, hint, field error; the form's result under its button                        |
| `EventSummary`                                    | One date, open on its ground: the date, the facts as small columns, the seat ring, the action        |
| `SeatRing` (`size`, `layout`)                     | Every chair on a ring, taken ones in ember from the top; the number free in the middle; words beside |
| `Stamp` (`turn`)                                  | The mark between two rings, the circle's name round it; turns with the scroll where `turn` is set    |
| `Lockup` (`variant`)                              | The mark and the word mark (`full` adds the region)                                                  |
| `Fact`                                            | Label, value in Fraunces, a note, under a rule; four in a row in the content column                  |
| `TestimonialList`                                 | One short voice large, the others as rows (author in the margin); every voice in full                |
| `Accordion`                                       | Questions as rows between lines; an accent disc whose plus turns into a minus                        |
| `LinkList`, `Prose` (`width`)                     | Where-next rows; rich text (`measure` / `column`)                                                    |
| `ModeToggle`                                      | Auto · Hell · Dunkel, in the footer and the phone menu                                               |

**Header.** 72px: the mark in ember and the word mark; from `nav` five links and one
action. Over the home opening the bar is clear with light text and its action is
outlined (the opening's own action is the one filled button on that screen); once
the page moves it is paper at 95 % and the action fills. The phone menu is a native
modal `<dialog>` on the forest, opening as a circle from its button.

**Footer.** The forest on every page, a line at its top: the lockup and one line
about the circle, navigation, contact, legal links and `ModeToggle`.

## Compositions

- **Home.** The opening on the forest: the statement at poster size (its phrase in
  the spark), the explanation, the one action and the next date; the photograph in
  its ring cut by the window's right edge, the next evening's seat ring on a disc
  overlapping it. Then: the facts in the content column beside their label (paper);
  the intro, its title crossing into the content, the first round's questions in
  the margin; the course on sand, each step with its index number in the margin;
  the five agreements on the moss as rows across the page, numbers in the spark;
  taking part (`#termine`, sand, "Dabei sein." as a poster word beside the next
  date); Markus, his quote crossing a large ring cut by the window; the voices on
  the moss; the FAQ with the contact line in the margin; staying in touch on the
  forest with the stamp cut by the right edge, running into the footer.
- **`/event`.** `PageIntro` with the stamp, every coming date as `EventSummary`
  beside the e-mail notification; the FAQ; a where-next band.
- **Event page.** The date line and the title, the place, the calendar and the
  registration on the forest headed by the seat ring; the evening's description
  (sand); the map; where next.
- **Personal page.** `PageIntro` with the photograph in a circle cut by the right
  edge, sections with their headings in the margin, values with index numbers, the
  FAQ, one closing invitation.
- **Legal pages, testimonial form, 404.** `PageIntro` and one column.
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
  in `em`, never `ch`.
- The seat ring (`SeatRing`) is decorative (`aria-hidden`): the line beside it says the
  seats in words.
- Forms: labels always visible, placeholders never instead; a field's message under
  the field, the form's result under its button (`FormStatus`), never a toast;
  entries survive an error; success says what actually happened.
- Focus is always visible (2px accent outline, offset 3px). Buttons and fields are
  44–52px high; touch targets at least 44px.
- The four moves are the only ways to break the grid, each at most once per
  section: margin column, overlap, bleed, poster word. No staircases of offset
  blocks, no rotation (the stamp turns, nothing else), no boxes around content.
- A token that the styleguide should describe carries a trailing comment in
  `theme.css`; German notes for people live in `lib/brand/notes.ts`
  (`tests/brand-notes.test.ts` keeps their keys real).
