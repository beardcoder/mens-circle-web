# Design system

## Public design update — October 2026

A calm invitation to a real meeting. The existing paper, charcoal and rust palette
stays; Playfair Display carries headings and quotes, DM Sans carries explanations,
controls and data. Public headings scale fluidly: hero 44–80px, section 30–52px.
Labels use sentence case. The home statement is a single, continuous heading.

The hero puts the invitation and actions on the left and a server-rendered next
date on the right. On phones they stack in that order. An empty schedule offers
email notifications; unavailable data shows an explicit reload action. Dates and
approved quotes are rendered on the server, using native Astro route caching.
Long quotes use native `details`, and long venue or fee values wrap without clipping.

Circle outlines recall the seating arrangement. On the home page they morph in
shape, rotation and size as the hero scrolls away; the portrait frame opens from
rounded corners into a rectangle as it enters. Both use native CSS view timelines
and remain static with reduced motion or without browser support. Reading text,
headings and the footer stay still. Motion is limited to interactions, the reading
progress indicator and the existing event dock. The optional breath guide starts
only on request; leaving its viewport, hiding the tab or enabling reduced motion
stops it. FAQ and menu transitions respect reduced motion.

Four principles: make the next step visible, group related information, keep
reading lines short, and reuse the same components for the same function.

## Files

| File                      | Role                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`    | Tokens (`@theme`), primitives, variants, the two surfaces, keyframes, base rules. Shared.                                                    |
| `src/styles/global.css`   | Public entry: Tailwind, theme, view transitions. Excludes the admin sources (`@source not`).                                                 |
| `src/styles/admin.css`    | Admin entry: Tailwind and theme; AdminLayout pins the dark mode.                                                                             |
| `src/lib/ui.ts`           | Class recipes: `button()`, `control()`, `link`, `label`, `fieldLabel`, `fieldHint`, `fieldError`, `formStatus`, `checkbox`, `card`, `panel`. |
| `src/lib/event-status.ts` | The view model every date summary renders (`eventView`, `splitFee`).                                                                         |
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

Headings use one colour. Section labels use sentence case (`label`) without added
letter spacing. Running text stays on `max-w-measure` (~62 characters), aligned
left. Long words wrap or hyphenate. Upright serif and sans faces preload; italics
load only when used. The CSS is shared in hashed assets rather than inlined in
every document.

**Grid and space.** One content width: 1200px between the side margins
(`max-w-page`, `Container`); margins 20 / 32 / 48px (`px-gutter`). Header,
sections and footer share these edges; full-width grounds keep their content on
them. Space per width on `:root`: `py-section` 64 → 96px, `py-band` (compact bands)
40 → 56px, `group` 32 → 48px (an explanation to the module after it), `grid` 32 →
48px (column gap). Label to title 12px, title to lead 24px. Breakpoints: `sm` 36rem,
`md` 48rem (tablet: two columns), `lg` 64rem (desktop: four columns), `nav` 68.75rem
(the header shows its links), `xl` 80rem. No section is forced to a screen's height.

**Shape.** Either fully round or square; there is no radius token. Round
(`rounded-full`) is every control: buttons and fields alike, as pills of the same
heights (`button()` and `control()` share 36 / 44 / 48px), the same outline
(`line-bold`) and the site's focus outline; a textarea keeps the curve at its
corners (`rounded-[1.5rem]`). Also round: icon buttons, the menu and close buttons, the
FAQ indicator, the scroll-to-top button — and the circle itself (rings, the
breath, the mark). Square is everything that holds: cards, panels, the breath
panel, photographs, the map, the calendar popover. Flat: cards are a thin line (`card`: `border-line-strong` on the
raised ground), never a shadow; a card carries at most one emphasis — no coloured
cap, no glow, no frame around a photo. Lists and quotes stand without cards, under
thin lines. `shadow-overlay` is reserved for admin dialogs, action menus and the save bar.

**Motion.** Short transitions answer interactions. Content never depends on an
entrance or a scroll reveal. Shared keyframes live in `theme.css`; no animation
dependency is needed. Reduced motion disables transitions and animated movement.

## Components

| Component                                         | Purpose                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Container`                                       | The 1200px width and the side margins                                                             |
| `Section` (`ground`, `space`)                     | A block: `default` / `alt` / `dark` ground, `default` / `band` space                              |
| `SectionHead` (`size`)                            | Label, section title (`section` / `sub`), lead                                                    |
| `PageIntro` (`lead`, `media` slots)               | The compact light opening of every sub-page, a photo beside it where there is one                 |
| `Eyebrow`                                         | A short section label (`label` recipe)                                                            |
| `Button` (`variant`, `size`, `block`, `decorate`) | Fully round: `primary` (one per module), `secondary`, `danger`; 48 / 52px high                    |
| `TextLink`                                        | A quiet, underlined link with a small arrow                                                       |
| `Field`, `control()`, `FormStatus`                | Label, a pill control (the buttons' heights), hint, field error; the result line under its button |
| `EventSummary`                                    | One date: label, the date on two fixed lines, time / place / fee / seats, the action that fits    |
| `TestimonialList` (Astro)                         | `short` at the quote size (one per section), `text` as running text; long voices fold             |
| `Accordion`                                       | Questions in DM Sans, a plus that becomes a minus, answers on the measure                         |
| `Split`, `LinkList`, `Prose` (`width`)            | Head beside content; where-next rows; rich text (`measure` / `column`)                            |
| `ModeToggle`                                      | Day / night, in the footer and the phone menu                                                     |

**Header.** 72px: the mark, from `nav` five content links and one filled action
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
  statement, explanation, action, date); at 1440 × 900 the action is in the first
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
- **Personal page.** `PageIntro` with the photo, split heading/text sections, the positions
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
