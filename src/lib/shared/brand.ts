/**
 * The brand's colour primitives by name, for code that cannot read CSS: the mails
 * built here and the listmonk templates (copied by hand). `src/styles/theme.css`
 * holds the same values as `--p-*`; `tests/brand.test.ts` fails when either drifts.
 * Mail-only shades sit in `MAIL`.
 */
export const BRAND = {
  linen: '#f1e8d9',
  sand: '#e2d4be',
  cream: '#f9f3e8',
  ink: '#18110b',
  inkSoft: '#2b2117',
  muted: '#5f503d',
  line: '#d6c6ad',
  lineStrong: '#bfab8e',
  control: '#766550',
  ember: '#c2804a',
  emberDeep: '#ad6c36',
  emberText: '#7c4117',
  emberTextDeep: '#63330f',
  onEmber: '#130e0a',
  emberLight: '#c2804a',
  emberTint: '#edd9be',
  emberTintNight: '#33241a',
  spark: '#c2804a',
  night: '#130e0a',
  nightAlt: '#1c150f',
  nightRaised: '#261d15',
  nightText: '#ebdfcd',
  nightMuted: '#a8957f',
  nightLine: '#2c2218',
  nightLineStrong: '#3f3225',
  nightControl: '#8a7862',
  forest: '#130e0a',
  forestNight: '#0b0705',
  forestRaised: '#1e1610',
  forestRaisedNight: '#140e09',
  forestControl: '#8a7862',
  moss: '#261d15',
  mossNight: '#1c150f',
  mossControl: '#948169',
  bone: '#ebdfcd',
  boneSoft: '#cdbca4',
  boneMuted: '#b6a48d',
} as const;

/** Shades only the mails use (the footer's rule on the forest). */
export const MAIL = {
  footerLine: '#2c2218',
} as const;

/** The mail font stacks: the site's faces where the client loads them, then system faces. */
export const MAIL_FONTS = {
  serif: "'Cormorant',Georgia,'Times New Roman',serif",
  sans: "'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif",
} as const;
