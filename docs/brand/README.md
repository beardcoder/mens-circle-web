# Brand outside the site

Logo files and the colours for other tools come from the same sources as the site:
the tokens in `src/styles/theme.css` and the master logo. The design itself is
described in [../design-system.md](../design-system.md). The print templates
(flyers, poster, card, posts) and their render script were removed; the preview
images `public/images/og-*.png` are plain committed files now.

## What lives where

| Path                                     | What                                                                      | How it is made         |
| ---------------------------------------- | ------------------------------------------------------------------------- | ---------------------- |
| `brand/logo/logo.svg`                    | The master logo, the only logo file drawn by hand                         | by hand                |
| `brand/logo/logo-*.svg`                  | Gold, deep gold on paper, bone on the dark ground, black, white           | `bun run brand:logo`   |
| `public/favicon*`, `public/images/logo*` | Favicons, manifest icons, `favicon.ico`, the JSON-LD logo, the mail marks | `bun run brand:logo`   |
| `brand/tokens.json`                      | W3C design tokens (colours with CMYK, type, space, sizes)                 | `bun run brand:export` |
| `brand/tokens.css`                       | The same as plain CSS custom properties                                   | `bun run brand:export` |
| `brand/palette.ase`                      | Adobe swatches (Illustrator, InDesign, Affinity, Procreate)               | `bun run brand:export` |
| `brand/palette.gpl`                      | GIMP and Inkscape palette                                                 | `bun run brand:export` |

Generated files are committed. Never edit them by hand:
`tests/brand-export.test.ts` and `tests/brand-logo.test.ts` fail when they no
longer match their source. After a change to `theme.css` run `bun run brand:export`;
after a change to the master logo run `bun run brand:logo`.

## Print

- The CMYK values in `tokens.json` are computed from sRGB and only a starting
  point. The gold prints darker on uncoated paper; prefer coated paper or agree the
  values with the printer, and ask for a proof.
- Fonts: Cormorant and Geist, both under the SIL Open Font License; see
  `src/assets/fonts/README.md`. Other tools: install them from Google Fonts.

## Logo

- The mark is four figures in a circle. Deep gold on paper, gold (or bone) on the
  forest, black or white where only one colour prints.
- Clear space all round: a quarter of the mark's height. Smallest size: 6 mm
  (24 px) for the mark with the word mark, 4 mm (16 px) for the mark alone.
- Never: other colours, outlines, shadows, the mark rotated, the word mark in
  another face.
