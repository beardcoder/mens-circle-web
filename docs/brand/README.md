# Brand outside the site

Flyers, the poster, the business card, posts, preview images, logo files and the
colours for other tools all come from the same sources as the site: the tokens in
`src/styles/theme.css`, the components in `src/components/brand/` and the template
list in `src/lib/brand/registry.ts`. The design itself is described in
[../design-system.md](../design-system.md); `/styleguide` on the site shows it.

## What lives where

| Path                                     | What                                                                      | How it is made                   |
| ---------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| `brand/logo/logo.svg`                    | The master logo, the only logo file drawn by hand                         | by hand                          |
| `brand/logo/logo-*.svg`                  | Ember, ember on linen, bone on forest, black, white                       | `bun run brand:logo`             |
| `public/favicon*`, `public/images/logo*` | Favicons, manifest icons, `favicon.ico`, the JSON-LD logo, the mail marks | `bun run brand:logo`             |
| `brand/tokens.json`                      | W3C design tokens (colours with CMYK, type, space, sizes)                 | `bun run brand:export`           |
| `brand/tokens.css`                       | The same as plain CSS custom properties                                   | `bun run brand:export`           |
| `brand/palette.ase`                      | Adobe swatches (Illustrator, InDesign, Affinity, Procreate)               | `bun run brand:export`           |
| `brand/palette.gpl`                      | GIMP and Inkscape palette                                                 | `bun run brand:export`           |
| `brand/out/`                             | Rendered templates, PDF and PNG (not committed)                           | `bun run brand:render`           |
| `public/images/og-*.png`                 | Preview images (Open Graph)                                               | `bun run brand:render --install` |

Generated files are committed except `brand/out/`. Never edit them by hand:
`tests/brand-export.test.ts` and `tests/brand-logo.test.ts` fail when they no
longer match their source. After a change to `theme.css` run `bun run brand:export`;
after a change to the master logo run `bun run brand:logo`.

## Templates

| Id            | Format                             | Size                | Output   |
| ------------- | ---------------------------------- | ------------------- | -------- |
| `flyer-a6`    | Flyer A6, front and back           | 105 × 148 mm + 3 mm | PDF, PNG |
| `flyer-dl`    | Flyer DIN lang                     | 99 × 210 mm + 3 mm  | PDF, PNG |
| `poster-a3`   | Poster A3                          | 297 × 420 mm + 3 mm | PDF, PNG |
| `card`        | Business card, front and back      | 85 × 55 mm + 2 mm   | PDF, PNG |
| `ig-square`   | Post 1:1                           | 1080 × 1080 px      | PNG      |
| `ig-portrait` | Post 4:5                           | 1080 × 1350 px      | PNG      |
| `ig-story`    | Story 9:16                         | 1080 × 1920 px      | PNG      |
| `og-default`  | Preview image of every page        | 1200 × 630 px       | PNG      |
| `og-markus`   | Preview image of the personal page | 1200 × 630 px       | PNG      |
| `logo-lockup` | Mark and word mark, transparent    | 1600 × 640 px       | PNG, PDF |

```bash
bun run brand:render                                          # all, dates from brand/data.example.json
bun run brand:render --from-site https://mens-circle.de       # the live coming dates
bun run brand:render --data my-dates.json --only flyer-a6,ig-square
bun run brand:render --only og-default,og-markus --install    # replace the preview images
```

The script builds the site once with the template pages switched on
(`BRAND_TEMPLATES=1`, `src/pages/brand/[template].astro`; every other build has no
such page), serves that build and prints each page in Chromium (Playwright). PDFs
have the trimmed size plus bleed and embed the fonts; print PNGs are 300 dpi, screen
PNGs exactly their pixel size (the script fails otherwise). `--from-site` reads
`/sitemap-events.xml` and `/api/public/events/<slug>`, so it needs no database. The
QR code opens the next evening's page; the printed address is the short one
(`mens-circle.de/event`). After `--install`, bump the `?v=` of the image where it is
referenced (`SeoHead.astro`, `lib/shared/event-meta.ts`, the personal page).

A template is an Astro component in `src/components/print/` built from `Sheet`
(the size with bleed; every size inside is a container unit `cqw` of the trimmed
sheet, so one design scales from a card to a poster), `Band` (another ground across
a sheet) and the shared pieces (`Statement`, `Dates`, `Contact`, `Photo`, and the
motifs from `src/components/brand/`). Its styles come from `src/styles/print.css`,
which `global.css` and `admin.css` keep out. Add a template: an entry in
`registry.ts`, a component, its id in `src/components/print/index.ts`.

## Print

- Bleed is 3 mm (the card 2 mm); keep text 6 mm inside the trimmed edge. The PDFs
  have no crop marks: online printers take the bleed size as it is; ask the printer.
- The PDFs are RGB. For offset print the printer converts to CMYK; ask for a proof.
  The CMYK values in `tokens.json` and on the styleguide are computed from sRGB and
  only a starting point. Ember and spark print darker on uncoated paper; prefer
  coated paper or agree the values with the printer.
- The QR code always stands on a light square with its quiet zone, at least 20 mm
  wide on print.
- Fonts: Cormorant and IBM Plex Sans, both under the SIL Open Font License; see
  `src/assets/fonts/README.md`. Other tools: install them from Google Fonts.

## Logo

- The mark is four figures in a circle. Ember on paper, ember (or bone) on the
  forest and the moss, black or white where only one colour prints.
- Clear space all round: a quarter of the mark's height. Smallest size: 6 mm
  (24 px) for the mark with the word mark, 4 mm (16 px) for the mark alone.
- Never: other colours, outlines, shadows, the mark rotated, the word mark in
  another face.
