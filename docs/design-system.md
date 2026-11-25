# Design system

## Idea: the circle of chairs

A men's circle meets in the evening, sits in a ring and listens. The site looks like
that evening: a centre, things turned towards each other, much air between them.
Its look is three colours and nothing else: paper and ink, the two grounds, each
the other's text, and one accent, the glow in the middle of the circle. Every
other tone (a band, a line, quieter text) is paper and ink mixed; every ground is
flat, with no gradient and no shadow. Titles stand in an elegant serif whose accent
phrase is set in italic. Ink carries what draws you in and what is spoken in the
circle, paper is for reading; at night the page itself turns to ink. The accent is
the mark, the one thing to do, the italic phrase, an index number and a link's
underline, the same on every ground. Everything is open and full-bleed: grounds run from edge
to edge, content stands between lines, nothing sits in a rounded card.

The grid is twelve columns and one edge. Four moves break it, and only these
(see "The four moves"): the margin column, the overlap, the bleed and the poster
word. The circle is the one motif, in four forms: the mark, the seat ring (every
chair of an evening on a ring), the stamp and the index number.

Everything that leaves the site (logo files, token exports) is in [docs/brand/README.md](brand/README.md).

## Stance — hold the space, don't perform

The page acts the way a circle leader does. Leading a circle means holding the
space instead of performing: listening, explaining the frame, asking for consent,
then stepping back. Translated into design:

- **Quiet.** Few effects, much air, one action per module. Grounds run from edge
  to edge; content stands on them, not in boxes. Lists between lines rather than
  cards (the facts, the questions of the first round, the agreements, the FAQ, the
  voices). No cards on public pages, not even for a date; the registration is a
  dark panel.
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
| `src/styles/theme.css`          | Tokens (`@theme`), primitives, variants, the surfaces, keyframes, base rules. Shared.                      |
| `src/styles/global.css`         | Public entry: Tailwind, theme, print of a page, page transitions, the FAQ, opening and scroll motion.      |
| `src/lib/ui.ts`                 | Class recipes: `button()`, `control()`, `link`, `label`, field and form states, `card`, `panel`, `margin`. |
| `src/lib/brand/theme-tokens.ts` | Parses `theme.css` into tokens for the token export.                                                       |
| `src/lib/shared/seats.ts`       | How full a circle is (`seatFill`) and where its chairs sit on the ring (`seatDots`).                       |
| `src/components/ui/`            | Components on the recipes (`Section`, `SectionHead`, `Poster`, `Index`, `Button`, `Field` …).              |
| `src/components/brand/`         | The motifs: `SeatRing`, `Stamp`, `Lockup`.                                                                 |

## Colour

There are three primitives, plain hex values on `:root`, and no fourth:

| Primitive    | Hex       | What it is                                          |
| ------------ | --------- | --------------------------------------------------- |
| `--p-paper`  | `#F4F1EA` | the light ground, and the text on ink               |
| `--p-ink`    | `#141210` | the dark ground, and the text on paper              |
| `--p-accent` | `#C8603A` | the glow: the mark, the one action, what is marked  |

Every role is one of them or paper and ink mixed (`color-mix`), picked per mode
with `light-dark()`. The page follows the system (Auto); `ModeToggle` offers
Auto · Hell · Dunkel and pins a choice as `data-mode`, set before first paint.
Never a hex value in markup, and never a new hex in `theme.css`: a new tone is a
new mix.

| Role            | Light                   | Night                     | Token                        | Use                                                |
| --------------- | ----------------------- | ------------------------- | ---------------------------- | -------------------------------------------------- |
| Page            | paper                   | ink + 4 % paper           | `ground`                     | the page                                           |
| Band            | paper + 6 % ink         | ink + 9 % paper           | `ground-alt` (`surface-alt`) | what belongs together: facts, course, dates        |
| Dark ground     | ink                     | ink                       | `surface-dark`               | opening, agreements, voices, registration, footer  |
| Text            | ink / 84 % ink          | paper / 84 % paper        | `fg`, `fg-soft`              | titles / running text                              |
| Secondary text  | 66 % ink                | 66 % paper                | `fg-muted`                   | labels, notes, captions; never a lead or a text    |
| Lines           | ink at 13 % / 24 %      | paper at 14 % / 24 %      | `line`, `line-strong`        | quiet structure; never alone a control             |
| Control outline | 50 % ink                | 50 % paper                | `line-bold`                  | inputs, secondary buttons (≥ 3:1)                  |
| Accent          | accent                  | accent                    | `accent`                     | the mark, the italic phrase, index numbers, a taken chair, a link's underline, the focus ring |
| Primary action  | accent under ink        | accent under ink          | `accent`, `accent-strong` (hover), `on-accent` | the one action of a module       |
| Refusal         | accent + 30 % ink       | accent + 22 % paper       | `danger`                     | a field's or a form's error, with words and a mark |

The accent is one hex on every ground. It holds 3:1 everywhere and 4.5:1 only on
ink, so it is large or drawn: a title's italic phrase, an index number, the mark,
a fill, an underline. It is never the colour of small text. A link is the text's
own colour on an accent underline (`link` in `lib/ui.ts`); a filled button is the
accent under an ink label in both modes.

The dark ground (`surface-dark`) is ink in both modes and re-declares the roles
with their night values. No ground carries a gradient, a glow or a texture, and
nothing casts a shadow: what floats (a dialog) has a line and the dimmed page
behind it. There is one exception, the home opening: it has no picture, and
four pale circles lie on its ink (`data-hero-glow`: three of the accent, a faint one of
paper, each a radial gradient to nothing), high and to the right, so the
statement stands on plain ink. On the personal page the opening's photograph
still runs softly into the ground (`data-hero-frame`, a mask on the picture).

A success is said in the text's own colour with a mark; `danger` is for a real
refusal only and always comes with words. Every
text pair holds at least 4.5:1 on every ground in both modes, every control line
and the accent at least 3:1 (`tests/contrast.test.ts`, read from `theme.css`). Check any new pair in both modes.

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
accent). `font-sans` is Geist (the static
regular and semibold, ~13 kB each; the regular also serves 500, the semibold 700): running text, navigation, forms, data.

| Token          | Size     | Use                                              |
| -------------- | -------- | ------------------------------------------------ |
| `text-poster`  | 72–216px | one poster word or number (`Poster`)             |
| `text-hero`    | 48–90px  | the home statement                               |
| `text-index`   | 48–104px | an index number in the margin (`Index`)          |
| `text-page`    | 44–96px  | a sub-page's title, an event title               |
| `text-section` | 36–72px  | a section's title, the one featured voice        |
| `text-sub`     | 26–36px  | subheadings, list titles, a fact's value, a date |
| `text-quote`   | 28–42px  | one short quote                                  |
| `text-xl`      | 18–22px  | FAQ questions, the questions of the first round  |
| `text-lg`      | 18–21px  | a lead                                           |
| `text-md`      | 17–19px  | running text (the body)                          |
| `text-base`    | 16px     | controls, buttons, data                          |
| `text-sm`/`xs` | 14/13px  | labels, hints, captions / the small print        |

Titles tighten their tracking as they grow (−1 % to −5 %). Labels are sentence
case: `Eyebrow` in the accent, only where it says something the title does not
(the place, the kind of page), never above every heading; data labels (`label`) in the
secondary colour. Running text stays on `max-w-measure` (~62 characters).

## Space and grid

One content width, 1200px, and one edge: the content sits 28 / 40 / 56px from the
window (`gutter`, `Container`) in every section, and the header shares it. The
grounds run from edge to edge. Space per width on `:root`: `py-section` 88 → 144px,
`py-band` 56 → 80px, `group` 40 → 64px, `grid` 32 → 48px (column gap). Breakpoints: `sm` 36rem, `md` 48rem, `lg` 64rem, `nav` 68.75rem,
`xl` 80rem. Only the home opening takes a screen's height (from `lg`, `min-h-svh`, its
content centred; a short window lets it grow); no other section is forced to one.

### The four moves

The grid breaks in these four ways only, each at most once per section, so the
page stays alive and calm.

1. **Margin column** (`margin` in `lib/ui.ts`): from `lg` a margin on columns 1–3
   for index numbers, labels and notes, the content on 4–12 (`margin.reading` 4–10
   for running text). A title may start in the margin and cross into the content
   (`margin.cross`, 1–10). Always on the left; below `lg` it stacks, margin first.
   Intro, course, voices, FAQ, the personal page's sections.
2. **Overlap**: an opening's poster line runs across the foot of its photograph,
   where the photograph has already run into the ground (the home page, the
   personal page). Never over a face, the sky or a busy part of the picture.
3. **Bleed**: a photograph, the stamp or a ground runs to the window's edge (the
   opening's photograph, the stamp at the right, the registration's ground).
   Sections clip horizontally (`Section`), so a bleed never scrolls.
4. **Poster word** (`Poster`, `text-poster`): one word or number as large as a
   poster, as the title ("Dabei sein."). At most one per screen.

Never: staircases of offset blocks, rotation (the stamp's ring of words turns,
nothing else stands at an angle), shadows, boxes or cards around content.

## Shape and depth

Open and square. Grounds, bands, the registration and the map have no radius and
run from edge to edge or out to the window. `rounded-full` is what you press
(buttons, chips, icon buttons, the FAQ disc) and the circle (photographs of people,
the seat ring, the stamp, the avatar). Single-line fields use the same pill shape and heights as buttons (48 / 44 / 36px).
Textareas and dialogs use the fixed 28px radius (`rounded-xl`). On public pages nothing is boxed and nothing is a rounded card:
facts, questions, agreements, steps, FAQ and voices are rows between thin lines.
Nothing casts a shadow; what floats has a line (`line-strong`) and the dimmed page behind it.

## Images

A photograph has no frame: it runs to the window's edge and softly into the ground
(a mask, `data-hero-frame`); a small portrait (the avatar) stands in a circle.
Warm, natural light; no caption. No staged group shots, no stock, no recognisable
participants without their explicit consent.

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
- Text, links and form controls stay sharp and readable at every scroll position.
- **Every opening arrives** once on load, in about a second (`data-opening`): the
  title's words rise, then the lead, the actions and the next date fade up, and a
  photograph settles from 1.05 (it is never hidden: it is the LCP). CSS only
  (global.css, "The opening").
- **The statement turns to ink** word by word as it crosses the window, from half
  the ink (≥ 3:1, large text) to full, its strong
  word to the accent, and back on the way up (`data-statement`: one view timeline,
  each word a slice of it by its index). The page's one scroll-led moment; whole
  and in full ink without view timelines or under reduced motion.
- **The home opening glows.** Its four pale circles drift on paths of their own, in
  11 s, 14 s, 17 s and 23 s, so the picture does not repeat for minutes (`glow-a`
  to `glow-d` in global.css). Each is a layer of its own and only
  `translate` and `scale` move. Screens only; at rest under reduced motion.
- **The stamp turns.** Its ring of words turns once in two minutes, linear.
- **The mark turns a quarter** on the spring when the logo is hovered.
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

Nothing follows the pointer and nothing is pinned or scroll-jacked.
A new animation has to pass the gate above.

Motion uses opacity and transforms. No script
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
that arrives does not move beyond its opening's one arrival. A browser without cross-document
transitions simply loads the page. The boot script in the head sets only the colour
mode before the first paint. Third-party scripts load `async`, so nothing queues in
front of the page's own.

### Lighthouse

Run it against a production build (`bun run build`, then the server on a disposable
database) for the home page on mobile and desktop and for any page whose motion
changed: `bunx lighthouse <url> --only-categories=performance,accessibility,best-practices,seo`
(add `--preset=desktop`). Hold: CLS 0, no forced reflow ("Forced reflow" insight
empty), no non-composited animations on scrolling text, the LCP element's render delay well under
half a second. Locally the server does not compress (the proxy does in
production), so the render-blocking stylesheet weighs more in the simulated
mobile score than it does live.

## Components

| Component                                         | Purpose                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Container`                                       | The 1200px width and the page's one edge (`px-gutter`)                                                    |
| `Section` (`ground`, `space`)                     | A block: `default` / `alt` / `dark`, edge to edge, clipping what bleeds                                   |
| `SectionHead` (`size`)                            | Eyebrow, title (`section` / `sub`), lead; with `margin.cross` it crosses into the content                 |
| `PageIntro` (`lead`, `media` slots)               | A sub-page's opening; with a photograph the poster opening, without one the stamp                         |
| `Poster`, `Index`                                 | The poster word, the index number                                                                         |
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

**Header.** 72px: the mark in the accent and the word mark; from `nav` four links and one
action. Over the home opening the bar is clear with light text and its action is
outlined (the opening's own action is the one filled button on that screen); once
the page moves it uses the opaque page ground and the action fills. The phone menu is a native
modal `<dialog>` on the dark ground, opening as a circle from its button.

**Footer.** The dark ground on every page, a line at its top: the lockup and one line
about the circle, navigation, contact, legal links and `ModeToggle`.

## Compositions

- **Home.** The opening on the dark ground, set like a poster and without a
  picture: four pale circles of the accent drift over the ink behind it, high and to
  the right; the statement at poster size (its phrase in the accent) across the
  whole width; under it one row on the grid, the explanation and the one action
  on the left, the next date as open lines on the
  right. On phones the date, time and place precede the action. Markus introduces himself with his portrait immediately after the opening. Then: the intro,
  its title crossing into the content, the first round's questions in the margin,
  the four facts as its last row; the statement on a screen of its own (`Statement`; an ordinary section under reduced motion);
  the course on the band, each step with its index number in the margin; the five
  agreements on the dark ground as rows across the page, numbers in the accent; the voices on the dark ground;
  the FAQ with the contact line in the margin; taking part (`#termine`, the band,
  "Dabei sein." as a poster word beside the next date); staying in touch on the
  dark ground with the stamp cut by the right edge, running into the footer. Open and
  wide throughout: no box or card.
- **`/event`.** `PageIntro` with the stamp, every coming date as `EventSummary`
  beside the e-mail notification; the FAQ; a where-next band.
- **Event page.** The date at a subheading's size over the title (the date tells one
  evening from the next); beside them, from the top of the page, the registration on
  the dark ground headed by the seat ring. Under the title the lead, then time, place and
  the evening's course as rows between lines (time and meeting place stand in the head on phones,
  where the registration follows the title), the calendar; the evening's description
  (the band); the map; where next.
- **Personal page.** `PageIntro` with the photograph (the poster opening), then
  sections set like the home page's: the title at section size crossing from the
  margin, the text on the reading line; the values as rows on the band; the FAQ; one
  closing invitation on the band.
- **Legal pages, testimonial form, 404.** `PageIntro` and one column.
- **Admin.** EmDash's own (`/_emdash/admin`); the site's design stops at the public pages.

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
  prerendered pages. The home opening has no image; its largest paint is the statement.
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
- A token carries a trailing comment in `theme.css`; the token export reads it.
