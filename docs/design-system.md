# Design system

"Feuerstelle": warm, earthy, direct — set like the flyer. Everything visual is
Tailwind CSS v4 utilities on top of the tokens in `src/styles/theme.css`. There are no
component stylesheets.

## Files

| File                     | Role                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `src/styles/theme.css`   | Tokens (`@theme`), variants, surfaces, the few custom utilities, keyframes, base rules. Shared.               |
| `src/styles/global.css`  | Public entry: `@layer vendor`, Tailwind, theme, view transitions. Excludes the admin sources (`@source not`). |
| `src/styles/admin.css`   | Admin entry: Tailwind and theme; AdminLayout pins the dark mode.                                              |
| `src/styles/leaflet.css` | Leaflet's stylesheet in the `vendor` layer, imported by the map only, so utilities win over it.               |
| `src/lib/ui.ts`          | Class recipes: `button()`, `control()`, `link`, `fieldLabel`, `fieldHint`, `fieldError`, `checkbox`, `panel`. |
| `src/components/ui/`     | The components built on them.                                                                                 |

## Tokens

**Colours** are semantic; `light-dark()` follows the page's colour scheme
(`data-mode` on `<html>`, set before first paint). Never use a raw hex in markup.

| Token                                         | Use                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `ground` / `ground-alt` / `raised`            | page, sand passages, panels and popovers                               |
| `surface`                                     | the ground of the current block (open seats, step dots, button hovers) |
| `fg` / `fg-soft` / `fg-muted`                 | headings and strong text / running text / captions and labels          |
| `accent` / `on-accent`                        | rust on cream, flame at night; what sits on an accent fill             |
| `line` / `line-strong` / `line-bold`          | hairlines / control borders and step rules / outlined buttons          |
| `field` / `field-focus`                       | form controls                                                          |
| `success` / `danger` / `alert` / `on-alert`   | states; a field error carries its own `alert` ground                   |
| `flame`, `rust`, `night`, `cream` (constants) | the brand mark, the portrait's flame bar                               |

**Surfaces** (`surface-sand`, `surface-night`, `surface-flame`, via `<Section ground>`)
re-declare the semantic colours, so text, hairlines, buttons, focus rings and inputs
inside follow the ground. One flame field per page at most.

**Type.** `font-serif` (Fraunces) speaks: headings at weight 400, small serif lines
500, its italic for questions and quotes. `font-sans` (Instrument Sans) explains.
Reading sizes `text-xs` (labels in capitals), `sm` (captions), `base` (compact text,
controls), `md` (reading), `lg` (leads), `xl`–`3xl`; the voice `text-display-1` (the
home sentence only), `display-2` (section and page titles), `display-3` (essays, rail
titles). A single long word in a title is capped by its column with `cqi` inside an
`@container`.

**Space.** The rhythm `section` > `group` > `item`, plus `gutter` (container sides),
`grid` (column gap of the 12-column field), `header` and `clearance` (fixed bar and
anchor offset). Wide screens (`lg`, 56rem) get more air: the base layer raises
`section`, `group` and `gutter`.

**Breakpoints.** `sm` 36rem, `md` 48rem, `lg` 56rem (the split line and the desktop
bar), `xl` 72rem (four abreast), `2xl` 100rem (root size 18px).

**Shape.** `rounded-control` (3px) on controls and panels; `rounded-full` only for
seats and round icon buttons. Shadows only for overlays (`shadow-overlay`,
`shadow-toast`).

**Motion.** `entrance:` (one-time entrances: motion allowed and not after a view
transition), `scroll-motion:` (scroll-driven, where timelines exist), `reveal`
(scroll-tied reveal), `animate-delay-*` (staggers through a non-inheriting `--delay`).
Everything rests under `prefers-reduced-motion`.

## Components

| Component                                       | Purpose                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `Section` (`ground`, `space`, `defer`)          | A block: its ground, its rhythm, the container                      |
| `Container`                                     | Page width (1680px) and gutters                                     |
| `Split` (`head` slot, `sticky`, `alignToTitle`) | The split line: head on columns 1–5, content from 7                 |
| `SectionHead` (`layout="stack"\|"split"`)       | Eyebrow, title, lead                                                |
| `PageOpening`                                   | The opening of a sub-page                                           |
| `Eyebrow`                                       | Label in capitals with an open seat                                 |
| `Button` (`variant`, `size`, `block`)           | Link or button; the primary carries seat and arrow                  |
| `TextLink`                                      | Quiet link with a moving arrow beside a primary action              |
| `Prose`                                         | Rich text from the content files                                    |
| `Field`                                         | Label, control, hint and the error slot lib/form.ts fills           |
| `DefList`, `LinkList`, `Quote`, `Badge`         | Facts, where-next rows, a participant's words, an admin status chip |

## Rules

- Complete class strings only (no `bg-${x}`); variants are maps of full strings
  (`ui.ts`, `Section`). Conditional classes with `class:list`.
- Never pass a class that sets the same property a component already sets (two
  utilities for one property have no reliable order): add a prop instead
  (`Eyebrow tone`, `TextLink strong`, `control('xs')`).
- Scripts find elements by `data-*` attributes and switch states with them
  (`data-open`, `data-state`, `data-tone`, `data-hiding`); styles read the same
  attributes through `data-[…]:` and `group-data-[…]:` variants.
- Arbitrary values are for one-off geometry (the hero orbit, the breath fields, the
  poster capitals); anything used twice becomes a token or a recipe.
- Allowed outside utilities, each with its reason in `theme.css`/`global.css`: font
  tokens, surfaces, the reduced-motion floor, the off-screen pause of the breath
  backgrounds, the focus ring default, view-transition pseudo-elements, keyframes,
  Leaflet's own elements (descendant variants on the map root).
- Focus is always visible (2px outline in the ground's text colour, the accent on
  controls). Touch targets are at least 44px on the public site.
