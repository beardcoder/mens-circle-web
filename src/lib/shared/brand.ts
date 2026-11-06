/**
 * The brand's colour primitives by name, for code that cannot read CSS: the mails
 * built here and the listmonk templates (copied by hand). `src/styles/theme.css`
 * holds the same values as `--p-*`; `tests/brand.test.ts` fails when either drifts.
 * Mail-only shades sit in `MAIL`.
 */
export const BRAND = {
  linen: '#f6f2ea',
  sand: '#ece4d4',
  sage: '#e2e7d8',
  cream: '#fffcf6',
  ink: '#1b241e',
  inkSoft: '#2e372f',
  muted: '#5a6255',
  line: '#ddd5c5',
  lineStrong: '#c8bfac',
  control: '#7a8072',
  ember: '#b4532a',
  emberDeep: '#953f1c',
  emberText: '#9a421d',
  onEmber: '#fff8f0',
  emberLight: '#f2a56c',
  emberTint: '#f5dfcd',
  emberTintNight: '#3a2619',
  gold: '#e8b65a',
  night: '#111915',
  nightAlt: '#17201a',
  nightRaised: '#1e2922',
  nightText: '#ece7dc',
  nightMuted: '#a6ae9f',
  nightLine: '#2a362e',
  nightLineStrong: '#3b4940',
  nightControl: '#7e8878',
  sageNight: '#1c2720',
  forest: '#16221b',
  forestNight: '#0c130f',
  forestRaised: '#213029',
  forestRaisedNight: '#18221c',
  forestControl: '#768379',
  bone: '#f2ede3',
  boneMuted: '#b4bbad',
} as const;

/** Shades only the mails use (the footer's rule on the forest). */
export const MAIL = {
  footerLine: '#353e37',
} as const;

/** The mail font stacks: the site's faces where the client loads them, then system faces. */
export const MAIL_FONTS = {
  serif: "'Fraunces',Georgia,'Times New Roman',serif",
  sans: "'Figtree','Helvetica Neue',Helvetica,Arial,sans-serif",
} as const;
