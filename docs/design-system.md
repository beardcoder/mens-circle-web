# Design system

Calm, warm, clear and contemporary: the site reads like a carefully made
invitation to a real meeting — personal, approachable, precise. It keeps its
identity (the mark and the circle, Playfair Display and DM Sans, a warm ground, a
restrained rust, the photograph) and gets its modernity from proportion, clear
navigation, fluid type, steady spacing and careful interaction. It is flat — clear
grounds and thin lines, no shadows — and it moves: openings rise in, blocks rise
into view as they scroll in, lines draw across, the circles breathe.
Built on Tailwind CSS v4 utilities over the tokens in `src/styles/theme.css`; there
are no component stylesheets.

Four rules decide:

1. **Meaning sets size.** The home statement carries the page; section titles
   support the reading.
2. **What belongs together stays together.** An explanation and its questions share
   one ground; a date's facts stand in one summary.
3. **Decoration has one place.** The circle: the rings behind the home opening,
   the breathing circle of the breath invitation, the phone menu that opens as a
   circle. Everything you press is round; everything that holds is square.
4. **Same function, same design.** Fields, buttons, dates and states come from
   shared components.

## Files

| File                      | Role                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`    | Tokens (`@theme`), primitives, variants, the two surfaces, keyframes, base rules. Shared.                                                    |
| `src/styles/global.css`   | Public entry: Tailwind, theme, view transitions. Excludes the admin sources (`@source not`).                                                 |
| `src/styles/admin.css`    | Admin entry: Tailwind and theme; AdminLayout pins the dark mode.                                                                             |
| `tailwind-animations`     | Animation utilities (`animate-delay-*`) and keyframes (`fade-in`, `pulse`), imported by both entries before `theme.css`.                     |
| `src/lib/ui.ts`           | Class recipes: `button()`, `control()`, `link`, `label`, `fieldLabel`, `fieldHint`, `fieldError`, `formStatus`, `checkbox`, `card`, `panel`. |
| `src/lib/event-status.ts` | The view model every date summary renders (`nextDateView`, `eventView`, `splitFee`).                                                         |
| `src/components/ui/`      | The components built on them.                                                                                                                |

## Tokens

**Colour roles.** Primitives (`--p-*`) are plain hex values on `:root`; the
semantic tokens pick them with `light-dark()`, so day and night (`data-mode`, set
before first paint, switched by `ModeToggle`) keep the same roles. There is one
palette: the earlier warm/cool switch is gone, and the boot script removes a stored
`mc-theme`.

| Role                  | Light                             | Token                             | Use                                                    |
| --------------------- | --------------------------------- | --------------------------------- | ------------------------------------------------------ |
| Ground                | `#F8F5EF`                         | `ground`                          | the page                                               |
| Secondary ground      | `#EFEAE2`                         | `ground-alt` (`surface-alt`)      | information that belongs together; sparingly           |
| Dark focus ground     | `#24221F`                         | `surface-dark`                    | the home opening and the footer only                   |
| Text / secondary text | `#28251F` / `#71685E`             | `fg`, `fg-soft` / `fg-muted`      | text on light grounds / readable secondary information |
| Line                  | `#D8D0C4`                         | `line`, `line-strong`             | quiet structure; never alone the outline of a control  |
| Control outline       | `#8A8175`                         | `line-bold`                       | inputs, secondary buttons, the FAQ indicator (≥ 3:1)   |
| Accent on light       | `#A54829`                         | `accent`, `accent-strong` (hover) | links and rare highlights                              |
| Primary button        | `#9F4429` / `#813621` / `#FFF9F3` | `fill`, `fill-strong`, `on-fill`  | the main action of a module, its hover, its label      |
| On the dark ground    | `#F8F5EF`, `#C7BFB3`, `#E6AA83`   | (re-declared by `surface-dark`)   | text, secondary text, accent                           |

Night keeps the roles: a dark ground (`#1B1917`), a slightly lighter secondary
ground (`#24221F`), light text, the light rust as accent; the focus ground goes
darker (`#121110`). `success`, `danger` and `alert` exist for real states only and
always come with words. Every text token holds at least 4.5:1 on every ground in
both modes, `line-bold` at least 3:1 (measured with a contrast audit over all page
types).

**Type.** `font-serif` (Playfair Display, weight 400) for chosen titles, short
quotes and the date in a summary; `font-sans` (DM Sans) for running text,
navigation, forms, data, FAQ questions and list titles. Sizes are `clamp()` tokens
named by role:

| Token          | Size      | Use                                     |
| -------------- | --------- | --------------------------------------- |
| `text-hero`    | 44–88px   | the home statement                      |
| `text-page`    | 36–64px   | a sub-page's title                      |
| `text-section` | 30–48px   | a section's title                       |
| `text-sub`     | 22–30px   | subheadings, the date in a summary      |
| `text-quote`   | 22–28px   | one short highlighted quote             |
| `text-xl`      | 18–22px   | FAQ questions, list titles, data values |
| `text-lg`      | 18–20px   | a short lead                            |
| `text-md`      | 17–19px   | running text (the body)                 |
| `text-base`    | 16px      | controls, buttons, data                 |
| `text-sm`/`xs` | 14 / 13px | hints, captions / labels                |

Titles are one colour. The italic in the accent colour appears twice on the whole
site: the phrase of the home statement (`titleEmphasis` in `home.json`) and the
second line of the breath invitation. Section labels are small spaced capitals
(`label`, `tracking-label` 0.14em) with no rule beside them; buttons, labels of
fields and navigation are in normal case. Running text stays on `max-w-measure`
(~62 characters), set left; centring is for nothing longer than a short line. A
long word in a title hyphenates or wraps (`hyphens-auto wrap-anywhere`), and a
known long one carries a soft hyphen (`Datenschutz&shy;erklärung`).

**Grid and space.** One content width: 1200px between the side margins
(`max-w-page`, `Container`); margins 20 / 32 / 48px (`px-gutter`). Header,
sections and footer share these edges; full-width grounds keep their content on
them. Space per width on `:root`: `py-section` 64 → 96px, `py-band` (compact bands)
40 → 56px, `group` 32 → 48px (an explanation to the module after it), `grid` 32 →
48px (column gap). Label to title 12px, title to lead 24px. Breakpoints: `sm` 36rem,
`md` 48rem (tablet: two columns), `lg` 64rem (desktop: four columns), `nav` 68.75rem
(the header shows its links), `xl` 80rem. No section is forced to a screen's height.

**Shape.** Either fully round or square, nothing in between; there is no radius
token. Round (`rounded-full`) is what you press: buttons (pills), icon buttons,
the menu and close buttons, the FAQ indicator, the scroll-to-top button — and the
circle itself (rings, the breath, the mark). Square is everything that holds:
fields and textareas, cards, panels, the breath panel, photographs, the map, the
calendar popover. Flat: cards are a thin line (`card`: `border-line-strong` on the
raised ground), never a shadow; a card carries at most one emphasis — no coloured
cap, no glow, no frame around a photo. Lists and quotes stand without cards, under
thin lines. The only shadow left (`shadow-overlay`) is the admin's toast.

**Motion.** It carries the site's energy; it never carries content.

- Interactions take ~180ms (`duration-180`): a button changes colour and rises 2px
  (pressed, it settles), its arrow slides; a header link draws a line under itself;
  the FAQ's round plus turns into a minus; the mark turns a little on hover.
- Openings rise in, one after the other (`entrance:animate-rise` with
  `animate-delay-*`, ≤ 260ms in all; never after a view transition): the home
  statement, a sub-page's title, an event's date.
- Blocks rise into view as they scroll in (`reveal`: section heads, list items,
  the breath panel, the date cards), and the lines over facts, phases, agreements
  and positions draw across (`draw`). Both are tied to the scroll position on a
  `view()` timeline: what is already on screen is already complete, and without
  timeline support or with reduced motion the content simply stands.
- The circles breathe: the hero's three rings out of phase (`animate-ring`,
  `animate-ring-slow`); the breath guide (`animate-breathe`, 4 s in, 5 s out — the
  words beside it say the same).
- The phone menu opens as a circle from its button (`clip-path`, `--nav-origin`),
  its links rising in; the scroll-to-top button appears past the first screen
  (`scroll-motion:`).
- No parallax (nothing moves at its own speed against the page), no scroll-tied
  size changes, no `content-visibility` (anchors land where they should). Under
  `prefers-reduced-motion` everything rests and the timed breath guide hides.

## Components

| Component                                         | Purpose                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Container`                                       | The 1200px width and the side margins                                                           |
| `Section` (`ground`, `space`)                     | A block: `default` / `alt` / `dark` ground, `default` / `band` space                            |
| `SectionHead` (`size`)                            | Label, section title (`section` / `sub`), lead                                                  |
| `PageIntro` (`lead`, `media` slots)               | The compact light opening of every sub-page, a photo beside it where there is one               |
| `Eyebrow`                                         | A short section label (`label` recipe)                                                          |
| `Button` (`variant`, `size`, `block`, `decorate`) | Fully round: `primary` (one per module), `secondary`, `ghost`, `danger`; 48 / 52px high         |
| `TextLink`                                        | A quiet, underlined link with a small arrow                                                     |
| `Field`, `control()`, `FormStatus`                | Label, control, hint, field error; the form's own result line under its button                  |
| `EventSummary`                                    | One date: label, the date on two fixed lines, time / place / fee / seats, the action that fits  |
| `Quote` (`variant`)                               | `short` at the quote size (one per section), `text` as running text; long voices fold           |
| `Accordion`                                       | Questions in DM Sans, a plus that becomes a minus, answers on the measure                       |
| `Split`, `LinkList`, `Prose` (`width`), `Badge`   | Head beside content; where-next rows; rich text (`measure` / `column`); the admin's status chip |
| `ModeToggle`                                      | Day / night, in the footer and the phone menu                                                   |

**Header.** 72px: the mark, from `nav` four content links and one filled action
("Termine"); below `nav` the action and a menu button. The phone menu is a native
modal `<dialog>` (focus trap, Escape, the focus returns to the button; the page holds
still under `:root:has(dialog:modal)`) that opens as a circle from its button, with
the links, the action and the display option. Over the home opening the bar is clear with light text and turns to the
opaque paper at once when the page moves (`over-hero:`, `data-scrolled`).

**Footer.** Compact on the dark focus ground on every page: the mark and one line,
navigation, contact, legal links and `ModeToggle`. It carries no invitation; a page
that ends on one sets it itself.

## Compositions

- **Home.** The opening on the dark ground: statement, explanation, the main action
  with the link to the evening's course, the next date beside them (on phones:
  statement, explanation, date, action); at 1440 × 900 the action is in the first
  screen. Then the facts band (`alt`, 4 / 2 / 1 columns, a long fee split into a
  short value and a note), the intro (text 7 columns, the questions 4 columns behind
  a line), the course in four phases (4 / 2 / 1) with the breath panel (`#haltung`)
  right under it, Markus (photo and text 5 : 7; on phones title, photo, text), the
  agreements (`alt`, two columns), the voices, the FAQ, and the close: taking part
  (`#termine`, `alt`, invitation and date summary), then staying in touch
  (`#newsletter`, the form "Termine per E-Mail erhalten" and the WhatsApp group as a
  link).
- **`/event`.** `PageIntro`, then every upcoming date as the same `EventSummary`
  (the soonest first; a full one says "ausgebucht" and offers the waiting list as the
  secondary action) beside the e-mail notification (`#benachrichtigung`); the FAQ;
  a compact where-next band. No closing call back to the same page.
- **Event page.** The date as the title with the action and the calendar, the
  summary beside it; the evening's description (plain text rendered with real
  paragraphs and lists, `plainTextToHtml`) beside the registration card; the map;
  where next. A past date offers no registration.
- **Personal page.** `PageIntro` with the photo, one reading column, the positions
  and the FAQ in the same components, one closing invitation (a compact `alt`
  band).
- **Testimonial form.** `PageIntro`, then the notes and the form in one column of
  ~672px (`max-w-form`).
- **Legal pages, 404.** `PageIntro` and the text in one ~720px column; nothing else.

## Rules

- Complete class strings only (no `bg-${x}`); variants are maps of full strings
  (`ui.ts`, `Section`, `SectionHead`). Conditional classes with `class:list`.
- Never pass a class that sets the same property a component already sets: add a
  prop instead (`SectionHead size`, `Button size`, `Prose width`, `control('xs')`).
- Scripts find elements by `data-*` attributes and switch states with them
  (`data-state`, `data-tone`, `data-scrolled`, `data-collapsed`); styles read the
  same attributes through `data-[…]:` and `group-data-[…]:` variants.
- Arbitrary values are for one-off geometry (where the hero's ring sits); anything
  used twice becomes a token or a recipe. No local values to patch a single section.
- Allowed outside utilities, each with its reason in `theme.css`/`global.css`: font
  tokens, primitives, the two surfaces, the reduced-motion floor, the scroll lock
  under a modal, the focus ring default, view-transition pseudo-elements, keyframes.
- No layout shift: every line of a date summary is one line (`truncate`; below 360px
  a row stacks its label over its value). Both serif styles are preloaded: the home
  statement sets its phrase in the italic. Titles measure in `em`, never `ch`.
- Forms: labels always visible, placeholders never instead; a field's message under
  the field, the form's result under its button (`FormStatus`), never a toast;
  entries survive an error; success says what actually happened.
- Focus is always visible (2px accent outline, offset; inputs add a 2px ring).
  Buttons and fields are 48–52px high; touch targets at least 44px.
