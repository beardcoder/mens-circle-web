# Design system

## Idea: the circle of chairs

A men's circle meets in the evening, sits in a ring and listens. The site looks like
that evening: a centre, things turned towards each other, much air between them.
Its look follows the dark-botanical theme (the `web-video-presentation` skill of
ConardLi/garden-skills): a warm near-black with soft pools of light, bone text, a
terracotta gold, an elegant serif whose accent phrase is set in italic. The night
mode is that theme; the day mode is built from the same family turned round: bone
becomes the paper, the near-black the text. The dark ground carries what draws you
in and what is spoken in the circle, paper is for reading. There is one accent, the theme's
clay terracotta: the mark, the one thing to do, links and the italic phrase; on
paper its deep tone. Everything is open and full-bleed: grounds run from edge
to edge, content stands between lines, nothing sits in a rounded card.

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

| Role            | Light                        | Night                 | Token                            | Use                                               |
| --------------- | ---------------------------- | --------------------- | -------------------------------- | ------------------------------------------------- |
| Page            | `#F1E8D9` warm paper         | `#130E0A`             | `ground`                         | the page                                          |
| Band            | `#E2D4BE`                    | `#1C150F`             | `ground-alt` (`surface-alt`)     | what belongs together: facts, course, dates       |
| Raised          | `#F9F3E8`                    | `#261D15`             | `raised`                         | fields, the QR square, the admin's cards          |
| Dark ground     | `#130E0A` / raised `#1E1610` | `#0B0705` / `#140E09` | `surface-dark`                   | opening, agreements, voices, registration, footer |
| Second dark     | `#261D15`                    | `#1C150F`             | `surface-moss`                   | print only; the site has three grounds            |
| Text            | `#18110B` / soft `#2B2117`   | `#EBDFCD` / `#CDBCA4` | `fg`, `fg-soft`                  | titles / running text                             |
| Secondary text  | `#5F503D`                    | `#A8957F`             | `fg-muted`                       | labels, notes, captions; never a lead or a text   |
| Lines           | `#D6C6AD` / `#BFAB8E`        | `#2C2218` / `#3F3225` | `line`, `line-strong`            | quiet structure; never alone a control            |
| Control outline | `#766550`                    | `#8A7862`             | `line-bold`                      | inputs, secondary buttons (≥ 3:1)                 |
| Accent          | `#7C4117`                    | `#C2804A` burnt clay  | `accent`, `accent-strong`        | links, labels, a highlighted word, index numbers  |
| Primary action  | `#7C4117` / `#63330F`        | `#C2804A` / `#AD6C36` | `fill`, `fill-strong`, `on-fill` | the one action of a module, a taken chair         |
| Spark           | `#C2804A`                    | same                  | `spark`                          | the italic phrase and numbers on the dark ground  |

The palette starts from the dark-botanical theme and is turned earthier and warmer
than it: the near-black is a brown-black like dark soil, the bone leans to linen,
the accent is a clay terracotta where the theme has a paler gold, and the pools of
light are a clay, a burnt rose and an ochre.

The primitives keep the names of the roles they had (`--p-forest` is the dark
ground, `--p-linen` the paper, `--p-sand` the band, `--p-ember` the accent: the
gold on the dark grounds, `--p-ember-text` its deep tone on paper; a filled button
is gold under a dark label there and deep under a light label here); the values are the theme's.
The dark ground carries the theme's signature, three soft pools of light in its
corners (`surface-dark` in theme.css),
still and never animated.

On the dark grounds the surfaces re-declare text (bone `#EBDFCD`, running text
`#CDBCA4`, muted `#B6A48D`), accent (`#C2804A`), lines (bone at 14–28 %) and the
control outline (`#8A7862`, on the second dark `#948169`). The spark is never text on paper or sand.
`success` and `danger` are for real states only and always come with words. Every
text pair holds at least 4.5:1 on every ground in both modes, every control line at
least 3:1 (`tests/contrast.test.ts`, pair by pair). Check any new pair in both modes.

## Type

`font-display` is Cormorant (Christian Thalmann, OFL), the theme's serif: light,
narrow, with a small x-height, so its sizes run a step larger than a sturdier
serif's would (`text-sub` 26–36px, `text-quote` 28–42px, the home statement
48–90px on two lines). Two variable files, upright and italic (~35 and ~38 kB,
`src/assets/fonts/`), declared from weight 500; figures lining (`lnum`). Every face is
`font-display: optional` and every file is preloaded, so a page is painted once and
never changes its faces afterwards: a font that arrives after the first paint
would re-lay the page out (the fallback breaks lines differently), which reads as
a flicker. A first visit on a slow line may stay in the fallback until the next
page. Titles are
500, the hero, page titles, index numbers and poster words 600. A highlighted
phrase in a title (`<em>`) is set in Cormorant's italic, in the accent (the
clay terracotta on the dark ground). `font-sans` is IBM Plex Sans (the static
regular and semibold, ~23 kB each; the regular also serves 500, the semibold 700): running text, navigation, forms, data.

| Token           | Size     | Use                                              |
| --------------- | -------- | ------------------------------------------------ |
| `text-poster`   | 72–216px | one poster word or number (`Poster`)             |
| `text-hero`     | 48–90px  | the home statement                               |
| `text-index`    | 48–104px | an index number in the margin (`Index`)          |
| `text-page`     | 44–96px  | a sub-page's title, an event title               |
| `text-section`  | 36–72px  | a section's title, the one featured voice        |
| `text-sub`      | 26–36px  | subheadings, list titles, a fact's value, a date |
| `text-quote`    | 28–42px  | one short quote                                  |
| `text-xl`       | 18–22px  | FAQ questions, the questions of the first round  |
| `text-lg`       | 18–21px  | a lead                                           |
| `text-md`       | 17–19px  | running text (the body)                          |
| `text-base`     | 16px     | controls, buttons, data                          |
| `text-sm`/`xs`  | 14/13px  | labels, hints, captions / the small print        |
| `text-marginal` | 14px     | a note in the margin column (`Marginal`)         |

Titles tighten their tracking as they grow (−1 % to −5 %). Labels are sentence
case: `Eyebrow` in the accent, only where it says something the title does not
(the place, the kind of page), never above every heading; data labels (`label`) in the
secondary colour. Running text stays on `max-w-measure` (~62 characters).

## Space and grid

One content width, 1200px, and one edge: the content sits 28 / 40 / 56px from the
window (`gutter`, `Container`) in every section, and the header shares it. The
grounds run from edge to edge. Space per width on `:root`: `py-section` 88 → 144px,
`py-band` 56 → 80px, `group` 40 → 64px, `grid` 32 → 48px (column gap), `overlap`
40 / 64 / 96px. Breakpoints: `sm` 36rem, `md` 48rem, `lg` 64rem, `nav` 68.75rem,
`xl` 80rem. Only the home opening takes a screen's height (from `lg`, `min-h-svh`, its
content centred; a short window lets it grow); no other section is forced to one.

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

Never: staircases of offset blocks, rotation (the stamp's ring of words turns,
nothing else stands at an angle), shadows, boxes
around content, text over a photograph.

## Shape and depth

Open and square. Grounds, bands, the registration and the map have no radius and
run from edge to edge or out to the window. `rounded-full` is what you press
(buttons, chips, icon buttons, the FAQ disc) and the circle (photographs of people,
the seat ring, the stamp, the avatar). Fields take `rounded-md` (8px) with the
buttons' heights (48 / 44 / 36px); what floats (a dialog) and the admin's cards
take `rounded-xl`. On public pages nothing is boxed and nothing is a rounded card:
facts, questions, agreements, steps, FAQ and voices are rows between thin lines.
`shadow-overlay` is for what floats; nothing else casts a shadow.

## Images

Two forms only: a person in a circle, a place (forest, evening, the room) in a
rectangle cut by the window or the sheet. One form per section; warm, natural
light; captions as margin notes. No staged group shots, no stock, no recognisable
participants without their explicit consent, no text on a photograph.

## Motion

The page is calm, and every piece of motion has a reason (the gate of the vendored
`animate` and `find-animation-opportunities` skills: how often is it seen, what is
it for, does it stay under 300 ms, does it help what is being read):

- **The change of page: a fade.** Cross-document view transitions
  (`@view-transition`, the View Transitions CSS API, global.css): the old page
  fades out while the new one fades in, and that is the whole arrival. Nothing
  rises, slides or scales, on either page: an opening is there with the first
  paint and stands (it is also the LCP, so nothing in it starts invisible). The one
  thing an opening still does is fill in the taken chairs of its seat ring, once.
- **Arriving.** Every piece below a page's opening fades in out of a blur as it is
  scrolled into the window, tied to the scroll itself: the `tailwind-animations`
  utilities `timeline-view animate-blurred-fade-in
animate-range-[entry_10%_contain_30%]` (a CSS-only Tailwind v4 package, imported
  in `global.css`). A piece starts to show once a tenth of it is in the window and
  stands clear when it has come nearly a third of the way up; scrolling back, it
  leaves the same way. There is no script: `global.css` ("Arriving") applies the
  classes to titles, paragraphs, list rows, figures, questions and lone links and
  buttons, plus whatever a component marks with `data-reveal` or
  `data-reveal-group`; where pieces nest only the outermost moves, so a new
  component needs no hook. Left alone: a page's opening (`data-hero`, `data-enter`:
  the first paint and the LCP), the fixed bars, dialogs and popovers. Footer rows
  are done once they are fully in (`entry 100%`): the page ends before they could
  rise further. Keep pieces small: one taller than the window is only clear near
  its top, so a list row that holds marked pieces (a date's summary) is not a
  piece itself. What stands in the lower third of the window when a page loads is
  still coming in. Browsers without view timelines, reduced motion and print show
  everything as it is.
- **The opening's photograph comes closer** as the opening leaves the window
  (`hero-photo-leave` on the opening's view timeline: from its lower edge, sinking
  12px, to 1.06), the one piece tied to the scroll besides the two bars.
- **The stamp turns.** Its ring of words turns once in two minutes, linear.
- **The mark turns a quarter** on the spring when the logo is hovered.
- **The dark ground moves.** The pools of light on every dark ground (opening,
  agreements, voices, registration, the last band, the footer, the phone menu)
  wander plainly but slowly, like the light of a fire on a wall: two layers (the
  clay with the ochre, and the burnt rose) on paths of their own, a tenth of the
  ground and back, growing and shrinking a little, in 24 s and 31 s, so the picture
  does not repeat for minutes (`pool-wander-a`, `pool-wander-b`, theme.css). The
  layers are `surface-dark::before` and `::after`, larger than the ground and
  clipped by `contain: paint`, so the compositor moves two layers by `translate`
  and `scale` and nothing is painted again. Screens only; at rest under reduced
  motion.
- **Answering the hand.** A button rises 2px and presses to 0.97 in 150 ms, arrows
  nudge, header links draw a line, the FAQ's `<details>` unfolds and its answer
  fades in with the space it gets (where `interpolate-size` exists its
  `::details-content` goes from height 0 to `auto` in 0.26 s; elsewhere and under
  reduced motion it toggles at once), the phone menu opens as a circle from its
  button, the round buttons of the bar and the mode options press to 0.97 too, the
  calendar popover fades in growing from 0.97 (it is centred, so it
  grows from its middle).
- **Answering a form.** The result under a form's button and a field's message
  arrive rather than appear: 4px up and in, 200 ms (`@starting-style` with
  `transition-behavior: allow-discrete`, since they go from `hidden` to shown). The
  fields of a form that is replaced by its answer fade out first (150 ms).
- **A chair is taken.** After a registration the next free chair of the panel's
  seat ring fills in and the count follows (`form:success`, EventRegister; the
  ring's own `seat-take`, 0.9 s on the spring): the one rare, glad moment of the
  site, so it may take its time. Not for a place on the waiting list.
- **The map arrives.** Its striped placeholder fades away in 200 ms once the map
  has drawn itself.
- **Day and night.** Choosing a colour mode changes every colour at once; a
  same-document view transition cross-fades it (the page change's own fade).
- **Two bars whose place depends on the scroll.** On an event page a dock with title
  and date slides out from behind the bar as the title passes under it, and back as
  the title returns (`EventDock`: the title's view timeline, `--event-title`). On the
  home page the phone's bottom bar (`ActionBar`) rises as the opening's action passes
  under the bar, steps down while the dates are on screen and leaves for the footer
  (three view timelines, `--hero-action`, `--dates`, `--page-footer`, each moving
  a layer of its own so all three stay on the compositor). `timeline-scope` on `body` lifts the names. Without scroll
  timelines, and under reduced motion, one observer and a CSS transition show and
  hide each; the observers also say whether the bottom bar can be reached (`inert`,
  `aria-hidden`, the tab stop).

The arrival is the one thing that follows the scroll both ways; nothing else
re-animates. Nothing follows the pointer and nothing is pinned or scroll-jacked.
A new animation has to pass the gate above.

Only opacity and transforms move, so the compositor carries every frame; the one
exception is the arrival's blur (`filter`), which Lighthouse lists as
non-composited and which costs main-thread work while a piece is coming in. No script
reads layout before the page has settled (state at a scroll position comes from an
`IntersectionObserver`, never from `scrollY`); state flags go on the element that
needs them, never on `<html>` while the page moves; the opening never waits for a
script. The registration form is in the page from the first frame; its answer
replaces the fields in place. There is no reading-progress bar, and the back-to-top
link shows on the desktop only.

### Page transitions

Native cross-document view transitions (global.css, "Page transitions"): the two
pages cross-fade (`plus-lighter`, 220 ms, linear, one duration for both halves, so
their opacities always sum to 1 and nothing sags grey). Only opacity moves, on the
compositor; no group animates, nothing is named and no script takes part. The page
that arrives does not move: no rise, no settle. A browser without cross-document
transitions simply loads the page. The boot script in the head sets only the colour
mode before the first paint. Third-party scripts load `async`, so nothing queues in
front of the page's own.

### Lighthouse

Run it against a production build (`bun run build`, then the server on a disposable
database) for the home page on mobile and desktop and for any page whose motion
changed: `bunx lighthouse <url> --only-categories=performance,accessibility,best-practices,seo`
(add `--preset=desktop`). Hold: CLS 0, no forced reflow ("Forced reflow" insight
empty), no non-composited animations beyond `blurred-fade-in`, the LCP element's render delay well under
half a second. Locally the server does not compress (the proxy does in
production), so the render-blocking stylesheet weighs more in the simulated
mobile score than it does live.

## Components

| Component                                         | Purpose                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Container`                                       | The 1200px width and the page's one edge (`px-gutter`)                                                    |
| `Section` (`ground`, `space`)                     | A block: `default` / `alt` / `moss` / `dark`, edge to edge, clipping what bleeds                          |
| `SectionHead` (`size`)                            | Eyebrow, title (`section` / `sub`), lead; with `margin.cross` it crosses into the content                 |
| `PageIntro` (`lead`, `media` slots)               | A sub-page's opening; a photograph bleeds right, without one the stamp stands there                       |
| `Poster`, `Index`, `Marginal`                     | The poster word, the index number, the margin note                                                        |
| `Eyebrow`                                         | A label above a title where it adds information: accent text                                              |
| `Button` (`variant`, `size`, `block`, `decorate`) | Round: `primary` (one per module), `secondary`, `danger`                                                  |
| `TextLink`                                        | A quiet, underlined link with a small arrow                                                               |
| `Field`, `control()`, `FormStatus`                | Label, a rounded field, hint, field error; the form's result under its button                             |
| `EventSummary`                                    | One date, open on its ground: the date, the facts as small columns, the seat ring, the action             |
| `SeatRing` (`size`, `layout`)                     | Every chair on a ring, taken ones in the accent from the top; the number free in the middle; words beside |
| `Stamp`                                           | The mark between two rings, the circle's name round it; it stands still                                   |
| `Lockup` (`variant`)                              | The mark and the word mark (`full` adds the region)                                                       |
| `Fact` (`layout`)                                 | Label, value in Cormorant, a note, under a rule; four in a row, or (`row`) lines with the label first     |
| `TestimonialList`                                 | One short voice large, the others as rows (author in the margin); every voice in full                     |
| `Accordion`                                       | Questions as rows between lines; an accent disc whose plus turns into a minus                             |
| `LinkList`, `Prose` (`width`)                     | Where-next rows; rich text (`measure` / `column`)                                                         |
| `ModeToggle`                                      | Auto · Hell · Dunkel, in the footer and the phone menu                                                    |

**Header.** 72px: the mark in the accent and the word mark; from `nav` five links and one
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
  the five agreements on the forest as rows across the page, numbers in the spark;
  taking part (`#termine`, sand, "Dabei sein." as a poster word beside the next
  date); Markus, one sentence of his under a rule, signed with his face; the voices on
  the forest; the FAQ with the contact line in the margin; staying in touch on the
  forest with the stamp cut by the right edge, running into the footer.
- **`/event`.** `PageIntro` with the stamp, every coming date as `EventSummary`
  beside the e-mail notification; the FAQ; a where-next band.
- **Event page.** The date at a subheading's size over the title (the date tells one
  evening from the next); beside them, from the top of the page, the registration on
  the forest headed by the seat ring. Under the title the lead, then time, place and
  the evening's course as rows between lines (`Zeit` stands in the head on phones,
  where the registration follows the title), the calendar; the evening's description
  (sand); the map; where next.
- **Personal page.** `PageIntro` with the photograph in a circle cut by the right
  edge, sections with their headings in the margin, values as rows, the
  FAQ, one closing invitation.
- **Legal pages, testimonial form, 404.** `PageIntro` and one column.
- **Admin.** The same tokens at night: forest grounds, rounded cards, the gold for the
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
- Arbitrary values are for one-off geometry (where the hero's photograph sits, the
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
  blocks, no rotation, no boxes around content.
- A token that the styleguide should describe carries a trailing comment in
  `theme.css`; German notes for people live in `lib/brand/notes.ts`
  (`tests/brand-notes.test.ts` keeps their keys real).
