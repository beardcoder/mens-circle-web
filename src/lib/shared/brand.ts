/**
 * The brand's colour primitives by name, for code that cannot read CSS: the mails
 * built here and the listmonk templates (copied by hand). `src/styles/theme.css`
 * holds the same values as `--p-*`; `tests/brand.test.ts` fails when either drifts.
 * Mail-only shades sit in `MAIL`.
 */
export const BRAND = {
  linen: '#f4ede2',
  sand: '#e7dccb',
  cream: '#fbf7f0',
  ink: '#1a140f',
  inkSoft: '#2e251c',
  muted: '#66594a',
  line: '#dccfbc',
  lineStrong: '#c6b69f',
  control: '#7d6e5d',
  ember: '#c98a56',
  emberDeep: '#b5773f',
  emberText: '#84481c',
  emberTextDeep: '#693815',
  onEmber: '#17120e',
  emberLight: '#c98a56',
  emberTint: '#f0e0cb',
  emberTintNight: '#33261a',
  spark: '#c98a56',
  night: '#17120e',
  nightAlt: '#201912',
  nightRaised: '#2a2119',
  nightText: '#ece3d5',
  nightMuted: '#a8998a',
  nightLine: '#2e251c',
  nightLineStrong: '#40342a',
  nightControl: '#8a7b6b',
  forest: '#17120e',
  forestNight: '#0e0a07',
  forestRaised: '#221b14',
  forestRaisedNight: '#18120d',
  forestControl: '#8a7b6b',
  moss: '#2a2119',
  mossNight: '#201912',
  mossControl: '#948573',
  bone: '#ece3d5',
  boneSoft: '#cfc1ad',
  boneMuted: '#b8a996',
} as const;

/** Shades only the mails use (the footer's rule on the forest). */
export const MAIL = {
  footerLine: '#2e251c',
} as const;

/** The mail font stacks: the site's faces where the client loads them, then system faces. */
export const MAIL_FONTS = {
  serif: "'Cormorant',Georgia,'Times New Roman',serif",
  sans: "'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif",
} as const;
