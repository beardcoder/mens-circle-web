# Design system

"Abendlicht": warm, grounded, sturdy — a circle of men, firm and outdoorsy, never
macho. Everything
visual is Tailwind CSS v4 utilities on top of the tokens in `src/styles/theme.css`.
There are no component stylesheets.

## Files

| File                     | Role                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`   | Tokens (`@theme`), variants, surfaces, the few custom utilities, keyframes, base rules. Shared.                       |
| `src/styles/global.css`  | Public entry: `@layer vendor`, Tailwind, theme, view transitions. Excludes the admin sources (`@source not`).         |
| `src/styles/admin.css`   | Admin entry: Tailwind and theme; AdminLayout pins the dark mode.                                                      |
| `tailwind-animations`    | Animation utilities and keyframes (CSS only), imported by both entries before `theme.css`.                            |
| `src/styles/leaflet.css` | Leaflet's stylesheet in the `vendor` layer, imported by the map only, so utilities win over it.                       |
| `src/lib/ui.ts`          | Class recipes: `button()`, `control()`, `link`, `fieldLabel`, `fieldHint`, `fieldError`, `checkbox`, `card`, `panel`. |
| `src/components/ui/`     | The components built on them.                                                                                         |

## Tokens

**Colours** are semantic; `light-dark()` follows the page's colour scheme
(`data-mode` on `<html>`, set before first paint). Never use a raw hex in markup.

| Token                                       | Use                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `ground` / `ground-alt` / `raised`          | the page's paper, stone bands, cards and popovers                      |
| `surface`                                   | the ground of the current block (open seats, button hovers)            |
| `fg` / `fg-soft` / `fg-muted`               | headings and strong text / running text / captions and labels          |
| `accent` / `accent-strong` / `accent-soft`  | rust by day, ember by night / its hover / a tint behind it             |
| `on-accent`                                 | what sits on an accent fill                                            |
| `line` / `line-strong` / `line-bold`        | hairlines and card borders / dividers that must show / control borders |
| `field`, `overlay`                          | form controls; the popover backdrop                                    |
| `success` / `danger` / `alert` / `on-alert` | states; a field error carries its own `alert` ground                   |
| `flame`, `night` (constants)                | the brand mark                                                         |

Every text token holds at least 4.5:1 on every ground, `line-bold` at least 3:1.

**Surfaces** (`surface-sand`, `surface-night`, via `<Section ground>`) re-declare the
semantic colours, so text, hairlines, buttons, focus rings and inputs inside follow
the ground. `sand` is the stone band for quiet passages; `night` is the dark band of
the statement and the home page's close, and the footer. Dark bands carry
`Contours` (contour lines of the hill country, the accent at 20%).

**Type.** `font-serif` (Fraunces) speaks: headings and serif lines at weight 600 in
sentence case, its italic (400) for questions and quotes. `font-sans` (Instrument
Sans) explains: text, UI. Reading sizes `text-xs`, `sm` (captions, labels), `base` (compact text,
controls), `md` (reading), `lg` (leads), `xl`, `2xl` (card titles); titles
`text-display-1` (the home sentence and the statement), `display-2` (page titles,
large section titles), `display-3` (section titles, the default of `SectionHead`).
Labels are bold capitals with `tracking-label` (0.12em): eyebrows, buttons, list and
fact terms, "Nächster Termin".

**Space.** The rhythm `section` > `group` > `item`, plus `gutter` (container sides),
`grid` (column gap), `header` (the 72px bar) and `clearance` (anchor offset and sticky
columns). Containers: `max-w-page` (78rem of content), `max-w-measure` (a reading
line).

**Breakpoints.** `sm` 36rem, `md` 48rem, `lg` 60rem (columns side by side, the desktop
navigation), `xl` 72rem, `2xl` 100rem (root size 18px).

**Shape.** Firm: `rounded-control` (3px) on controls, buttons and chips,
`rounded-card` (4px) on cards and panels; `rounded-full` only for seats and round icon
buttons. Cards are flat with a solid `line-strong` border; `shadow-overlay` only on
popovers and the phone menu. Heavy rules mark beginnings: Ablauf steps and facts under
a 2–3px `fg` rule, a 4px accent bar on top of the date cards, a 4px accent rule left
of quotes.

**Motion.** `entrance:` (one-time entrances: motion allowed and not after a view
transition), `scroll-motion:` (scroll-driven, where timelines exist), `reveal`
(scroll-tied reveal), `animate-delay-*` (staggers; `animation-delay`, from
tailwind-animations).
Animations: `fade-in-up`, `fade-in`, `breath` (the background's natural breath, a
34.6 s phrase of three breaths) with `breath-parallax` (its scroll depth), `breathe`
(the steady 10 s guide: 4 in, 0.5 hold, 5 out, 0.5 rest), `skeleton`, `glow`. The generic ones use the keyframes of
[tailwind-animations](https://tailwind-animations.com) (`fade-in-up`, `fade-in`,
`pulse`), re-timed in `theme.css` to the theme's easing; the circle's own (`breath`,
`breath-parallax`, `breathe`, `glow`) are ours. Pick further motions from its catalog (`.claude/skills/tailwind-animations`)
and give them a theme token instead of its default timing. Everything
rests under `prefers-reduced-motion`.

## Components

| Component                                         | Purpose                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `Section` (`ground`, `space`, `defer`)            | A block: its ground, its rhythm, the container                          |
| `Container`                                       | Page width and gutters                                                  |
| `Split` (`head` slot, `sticky`)                   | Head on columns 1–4, content on 6–12 from `lg`; stacked below           |
| `SectionHead` (`size`, `align`, `leadHtml`, …)    | Eyebrow, title, lead                                                    |
| `PageOpening`                                     | The opening of a sub-page                                               |
| `Eyebrow`                                         | Bold accent capitals behind a short bar                                 |
| `Button` (`variant`, `size`, `block`, `decorate`) | Link or button; the primary carries an arrow (`data-label` on its text) |
| `TextLink`                                        | Quiet link with a moving arrow beside a primary action                  |
| `Prose`                                           | Rich text from the content files                                        |
| `Field`                                           | Label, control, hint and the error slot lib/form.ts fills               |
| `DefList`, `LinkList`, `Quote`, `Badge`           | Facts, where-next rows, a participant's words, a status chip            |
| `SeatMeter`                                       | An event's seats as square-cut fields (taken filled, open outlined)     |
| `BreathField` (`strength`)                        | The circle in the background: warm light breathing, parallax on scroll  |
| `Contours`                                        | Contour lines behind a dark band's content                              |

Cards (`card`, `panel`) are for self-contained units — the date, agreements, voices,
forms, questions — never for running text.

## Rules

- Complete class strings only (no `bg-${x}`); variants are maps of full strings
  (`ui.ts`, `Section`). Conditional classes with `class:list`.
- Never pass a class that sets the same property a component already sets (two
  utilities for one property have no reliable order): add a prop instead
  (`SectionHead size`, `Button size`, `control('xs')`).
- Scripts find elements by `data-*` attributes and switch states with them
  (`data-open`, `data-state`, `data-tone`, `data-hiding`); styles read the same
  attributes through `data-[…]:` and `group-data-[…]:` variants.
- Arbitrary values are for one-off geometry (the hero photo and its date card, where
  the rings sit); anything used twice becomes a token or a recipe.
- Allowed outside utilities, each with its reason in `theme.css`/`global.css`: font
  tokens, surfaces, the reduced-motion floor, the off-screen pause of breathing
  elements, the focus ring default, view-transition pseudo-elements, keyframes,
  Leaflet's own elements (descendant variants on the map root).
- No layout shift: an island's fallback sets the same lines as its loaded state.
- Focus is always visible (2px accent outline, offset; controls add a soft ring).
  Touch targets are at least 44px on the public site.
