# Design system

Warm earth, a fire just out of sight: a circle of men, grounded and calm, never
macho, never a wellness retreat. The look follows the site's earlier hand-written
design (Playfair Display and DM Sans, earth and terracotta, breathing hairline
rings), rebuilt on Tailwind CSS v4 utilities over the tokens in
`src/styles/theme.css`. There are no component stylesheets.

## Files

| File                     | Role                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`   | Tokens (`@theme`), palette primitives, variants, surfaces, the few custom utilities, keyframes, base rules. Shared.                          |
| `src/styles/global.css`  | Public entry: `@layer vendor`, Tailwind, theme, view transitions. Excludes the admin sources (`@source not`).                                |
| `src/styles/admin.css`   | Admin entry: Tailwind and theme; AdminLayout pins the dark mode.                                                                             |
| `tailwind-animations`    | Animation utilities and keyframes (CSS only), imported by both entries before `theme.css`.                                                   |
| `src/styles/leaflet.css` | Leaflet's stylesheet in the `vendor` layer, imported by the map only, so utilities win over it.                                              |
| `src/lib/ui.ts`          | Class recipes: `button()`, `control()`, `link`, `fieldLabel`, `fieldHint`, `fieldError`, `checkbox`, `card`, `panel`, `capCard`, `capPanel`. |
| `src/components/ui/`     | The components built on them.                                                                                                                |

## Tokens

**Palettes.** The colours come from OKLCH primitives (`--p-bone`, `--p-parchment`,
`--p-sand`, `--p-earth-*`, `--p-ink`, `--p-terra*`, …) on `:root`. Two palettes:
`warm` (earth and terracotta, the default) and `cool` (spruce and fern), which
`:root[data-theme='cool']` sets by re-pitching only the primitives; every semantic
token follows. Independently, `data-mode` picks day or night (`light-dark()`). Both
are set before first paint from `localStorage` (`mc-theme`, `mc-mode`) and switched
by `ThemeSwitch` (`lib/theme.ts`, which also keeps `<meta name="theme-color">` in
step).

**Colours** are semantic. Never use a raw hex in markup.

| Token                                       | Use                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `ground` / `ground-alt` / `raised`          | the page (bone / ink), quiet bands, cards and popovers                      |
| `surface`                                   | the ground of the current block (button hovers)                             |
| `fg` / `fg-soft` / `fg-muted`               | headings and strong text / running text / captions and labels               |
| `accent` / `accent-strong` / `accent-soft`  | terracotta as text (deep by day, light by night) / its hover / a tint       |
| `fill` / `fill-strong` / `on-fill`          | the terracotta of buttons, seats and bars / its hover / the label on it     |
| `on-accent`                                 | what sits on an accent ground                                               |
| `line` / `line-strong` / `line-bold`        | hairlines / dividers that must show / control borders                       |
| `field`, `overlay`                          | form controls; the popover backdrop                                         |
| `success` / `danger` / `alert` / `on-alert` | states; a field error carries its own `alert` ground                        |
| `flame`, `bone`, `parchment`, `sand`, …     | constants: the mark, the light text on the dark openings, the rings' colour |

Every text token holds at least 4.5:1 on every ground, `line-bold` at least 3:1.
`fill` is a ground for `on-fill` (bold capitals), not a text colour.

**Surfaces** (`surface-*`, via `<Section ground>`) re-declare the semantic colours,
so text, hairlines, buttons, focus rings and inputs inside follow the ground:

| Ground   | Utility                | Where                                                                  |
| -------- | ---------------------- | ---------------------------------------------------------------------- |
| `alt`    | `surface-alt`          | parchment bands (facts, voices)                                        |
| `sand`   | `surface-sand`         | the stone band (Moderator, FAQ on sub-pages, map, closing invitations) |
| `night`  | `surface-night grain`  | deep earth: the openings (`HeroFrame`), the journey, registration      |
| `earth`  | `surface-earth grain`  | the brown panel (`HalfBleed`), the newsletter band                     |
| `forest` | `surface-forest grain` | the WhatsApp band (its own green fill)                                 |
| `ink`    | `surface-ink`          | the footer                                                             |

`grain` lays a faint noise over a dark ground. Light bands are 88% opaque, so the
page's breathing light (`BreathBackdrop`) runs on beneath them.

**Type.** `font-serif` (Playfair Display, variable) speaks: titles at weight 400,
tracked in, in sentence case; the italic is the accent — a phrase of a title in
`<em>` (set by `titleEmphasis` on `SectionHead`, `PageOpening`, the hero) turns
italic and terracotta; quotes and questions in the italic. The serif also names
every row of a list — fact values, agreements, values, FAQ questions, link rows,
card titles — so a list reads as a set of short titles. `font-sans` (DM Sans,
variable) explains: running text, labels, UI. The Ablauf steps carry large faint
serif figures `01`–`04`; nothing else is numbered. Sizes `text-xs` … `lg` for reading, `xl`, `2xl` for
card titles; `text-display-1` (the home sentence), `display-2` (page and large
section titles), `display-3` (section titles, `SectionHead`'s default). Labels are
bold capitals: `tracking-label` (0.12em) on buttons and field labels,
`tracking-eyebrow` (0.32em) on eyebrows behind their long fading rule.

**Space.** The rhythm `section` > `group` > `item`, plus `gutter` (container sides),
`grid` (column gap), `header` (the 80px bar) and `clearance` (anchor offset and
sticky columns). Containers: `max-w-page` (1400px), `max-w-prose` (centred text),
`max-w-measure` (a reading line).

**Breakpoints.** `sm` 36rem, `md` 48rem, `lg` 56.25rem (columns side by side), `xl`
72rem, `2xl` 100rem (root
size 18px).

**Shape.** Soft but sure: `rounded-control` (8px) on fields, `rounded-card` (12px)
on cards; buttons are pills (`rounded-full`), as are the seats, the round icon
buttons and the address field beside its button (`control('md', true)`). Cards are
raised on `shadow-card` with a hairline border; a card that holds a date or a form
carries a 4px `fill` cap across its top (`capCard`, `capPanel`), cut straight by
the card's corners — never a side bar, which bends around a rounded corner. On a
dark opening a date is never a card: it stands open on the ground behind a
hairline (above it on phones, beside it from `lg`), like the seats of an event. Groups of equals stand in hairline grids (facts, agreements,
values, voices, link rows), never in boxes: hairlines above and below the group and
between its cells, no frame around it.

**Motion.** `entrance:` (one-time entrances: motion allowed and not after a view
transition), `scroll-motion:` (scroll-driven, where timelines exist), `reveal`
(scroll-tied reveal), `animate-delay-*` (staggers, from tailwind-animations).
Animations: `fade-in-up`, `fade-in` (tailwind-animations, re-timed to the theme's
easing); ours: `ring` / `ring-slow` (the rings widen and settle, 18–30 s, out of
phase), `hero-leave` and `hero-rings-drift` (an opening lifts away on scroll, its
rings drift down), `float` (the moderator's photo), `breath` with
`breath-drift` and `breath-parallax` (the page's background light), `breathe` (the
10 s guide in the statement), `skeleton`, `glow`. Everything rests under
`prefers-reduced-motion`.

## Components

| Component                                         | Purpose                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Section` (`ground`, `space`, `defer`)            | A block: its ground, its rhythm, the container                                                                      |
| `Container`                                       | Page width and gutters                                                                                              |
| `HeroFrame` (`height`)                            | The dark opening: two glows and the rings, nothing at its sides; `data-hero`                                        |
| `HalfBleed`                                       | Reading on the paper beside a brown panel that runs to the screen's edge                                            |
| `Rings` (`set`)                                   | Breathing hairline rings behind a block: `hero`, `panel`, `close`                                                   |
| `Split` (`head` slot, `sticky`)                   | Head on columns 1–4, content on 6–12 from `lg`; stacked below                                                       |
| `SectionHead` (`size`, `align`, `titleEmphasis`)  | Eyebrow, title (an italic accent phrase), lead                                                                      |
| `PageOpening` (`titleEmphasis`, `media` slot)     | The opening of a sub-page, on `HeroFrame`                                                                           |
| `Eyebrow`                                         | Spaced accent capitals behind a long fading rule                                                                    |
| `Button` (`variant`, `size`, `block`, `decorate`) | Pill link or button: `primary`, `secondary`, `outline` (dark grounds), …                                            |
| `TextLink`                                        | Quiet capitals with a moving arrow beside a primary action                                                          |
| `Prose`                                           | Rich text from the content files                                                                                    |
| `Field`                                           | Label, control, hint and the error slot lib/form.ts fills                                                           |
| `DefList`, `LinkList`, `Badge`                    | Facts, where-next rows between hairlines, a status chip                                                             |
| `Quote` (`size`)                                  | A participant's words in the serif italic: `lg` beside a rule, `md` under a large accent mark, the name in capitals |
| `SeatMeter`                                       | An event's seats as a row of bars (taken filled, open faint)                                                        |
| `ThemeSwitch`                                     | Palette (flame / leaf) and day/night                                                                                |
| `BreathBackdrop` / `BreathField`                  | The page's breath: fixed fields of warm light behind everything                                                     |

The header is the page's opaque paper — never glass, the hero's title would show
through; over a `HeroFrame` (`over-hero:`) it is light and clear until the page scrolls (`data-scrolled`, `lib/site-header.ts`). The menu
is a full-screen dark overlay that opens as a circle from its toggle.

## Rules

- Complete class strings only (no `bg-${x}`); variants are maps of full strings
  (`ui.ts`, `Section`, `Rings`). Conditional classes with `class:list`.
- Never pass a class that sets the same property a component already sets (two
  utilities for one property have no reliable order): add a prop instead
  (`SectionHead size`, `Button size`, `control('xs')`).
- Scripts find elements by `data-*` attributes and switch states with them
  (`data-open`, `data-state`, `data-tone`, `data-scrolled`); styles read the same
  attributes through `data-[…]:` and `group-data-[…]:` variants.
- Arbitrary values are for one-off geometry (where the rings sit, the glows of an
  opening); anything used twice becomes a token or a recipe.
- Allowed outside utilities, each with its reason in `theme.css`/`global.css`: font
  tokens, palette primitives, surfaces, `grain`, the reduced-motion floor, the
  off-screen pause of breathing elements, the focus ring default, view-transition
  pseudo-elements, keyframes, Leaflet's own elements (descendant variants on the map
  root).
- No layout shift: an island's fallback sets the same lines as its loaded state, and
  every line of the date card is one fixed line. Both serif styles are preloaded:
  the home title sets its accent in the italic.
- Focus is always visible (2px accent outline, offset; controls add a soft ring).
  Touch targets are at least 44px on the public site.
