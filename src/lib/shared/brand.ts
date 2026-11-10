/**
 * The brand's colour primitives by name, for code that cannot read CSS: the mails
 * built here and the listmonk templates (copied by hand). `src/styles/theme.css`
 * holds the same values as `--p-*`; `tests/brand.test.ts` fails when either drifts.
 * Mail-only shades sit in `MAIL`.
 */
export const BRAND = {
  linen: '#f4eee2',
  sand: '#e6dac4',
  cream: '#fffcf6',
  ink: '#1b241e',
  inkSoft: '#2e372f',
  muted: '#565e51',
  line: '#d8cdb8',
  lineStrong: '#c2b59c',
  control: '#767c6e',
  ember: '#b4532a',
  emberDeep: '#953f1c',
  emberText: '#9a421d',
  onEmber: '#fff8f0',
  emberLight: '#f2a56c',
  emberTint: '#f5dfcd',
  emberTintNight: '#3a2619',
  spark: '#e8b65a',
  night: '#0f1410',
  nightAlt: '#1d2019',
  nightRaised: '#262b23',
  nightText: '#ece7dc',
  nightMuted: '#a6ae9f',
  nightLine: '#2b3029',
  nightLineStrong: '#3d4339',
  nightControl: '#7e8878',
  forest: '#16221b',
  forestNight: '#0c130f',
  forestRaised: '#213029',
  forestRaisedNight: '#18221c',
  forestControl: '#768379',
  moss: '#2c3a30',
  mossNight: '#1a2a20',
  mossControl: '#8a968a',
  bone: '#f2ede3',
  boneMuted: '#b4bbad',
} as const;

/** Shades only the mails use (the footer's rule on the forest). */
export const MAIL = {
  footerLine: '#353e37',
} as const;

/** The mail font stacks: the site's faces where the client loads them, then system faces. */
export const MAIL_FONTS = {
  serif: "'Vollkorn',Georgia,'Times New Roman',serif",
  sans: "'Figtree','Helvetica Neue',Helvetica,Arial,sans-serif",
} as const;
