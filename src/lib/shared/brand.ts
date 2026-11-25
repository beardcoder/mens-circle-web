/**
 * The brand's three colours, for code that cannot read CSS: the mails built here,
 * the listmonk templates (copied by hand) and the logo files. `src/styles/theme.css`
 * holds the same values as `--p-*`; `tests/brand.test.ts` fails when either drifts.
 * The mails cannot mix colours, so the tones they use are written out in `MAIL`,
 * held equal to the theme's roles by the same test.
 */
export const BRAND = {
  paper: '#f4f1ea',
  ink: '#141210',
  accent: '#c8603a',
} as const

/** The theme's mixed tones the mails use, by role (light values; `onInk` on the dark masthead and footer). */
export const MAIL = {
  muted: '#605e5a',
  mutedOnInk: '#a8a5a0',
  line: '#d7d4ce',
  lineStrong: '#bebbb6',
  lineOnInk: '#33312f',
} as const
