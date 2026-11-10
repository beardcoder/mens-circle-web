/**
 * The brand's colour primitives by name, for code that cannot read CSS: the mails
 * built here and the listmonk templates (copied by hand). `src/styles/theme.css`
 * holds the same values as `--p-*`; `tests/brand.test.ts` fails when either drifts.
 * Mail-only shades sit in `MAIL`.
 */
export const BRAND = {
  linen: '#f5f2ed',
  sand: '#e8e4df',
  cream: '#fcfbf8',
  ink: '#141312',
  inkSoft: '#2a2622',
  muted: '#625a51',
  line: '#ddd7ce',
  lineStrong: '#c8c0b6',
  control: '#7a7268',
  ember: '#d4a574',
  emberDeep: '#c08f5c',
  emberText: '#85501f',
  emberTextDeep: '#6b3f16',
  onEmber: '#141312',
  emberLight: '#d4a574',
  emberTint: '#efe3d3',
  emberTintNight: '#2e241a',
  spark: '#d4a574',
  night: '#141312',
  nightAlt: '#1c1a18',
  nightRaised: '#25221f',
  nightText: '#e8e4df',
  nightMuted: '#a39a8f',
  nightLine: '#2a2622',
  nightLineStrong: '#3a352f',
  nightControl: '#857c71',
  forest: '#141312',
  forestNight: '#0a0a0a',
  forestRaised: '#1f1d1a',
  forestRaisedNight: '#151413',
  forestControl: '#857c71',
  moss: '#25221f',
  mossNight: '#1c1a18',
  mossControl: '#8f867b',
  bone: '#e8e4df',
  boneSoft: '#c8c0b6',
  boneMuted: '#b3aaa0',
} as const;

/** Shades only the mails use (the footer's rule on the forest). */
export const MAIL = {
  footerLine: '#2a2622',
} as const;

/** The mail font stacks: the site's faces where the client loads them, then system faces. */
export const MAIL_FONTS = {
  serif: "'Cormorant',Georgia,'Times New Roman',serif",
  sans: "'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif",
} as const;
