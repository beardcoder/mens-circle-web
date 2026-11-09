/**
 * What the styleguide says about each token, in German (the page is for people who
 * design with the brand, not for code). Keyed by the token's name in theme.css;
 * tests/brand-notes.test.ts fails when a key no longer names a token.
 */

/** Colour roles by name (`--color-<name>`): what they are for. */
export const COLOUR_USE: Record<string, string> = {
  ground: 'Papier: der Grund jeder Seite und jedes Drucks.',
  'ground-alt': 'Sand: ein Band für Zusammengehöriges (Fakten, Ablauf, Termine).',
  raised: 'Creme: Felder und Karten, die über dem Grund liegen.',
  fg: 'Tinte: Titel und Text.',
  'fg-soft': 'Fließtext, eine Spur weicher als die Titel.',
  'fg-muted': 'Moosgrau: Labels, Notizen, Bildunterschriften.',
  accent: 'Glut als Schrift: Links, Labels, ein hervorgehobenes Wort.',
  'accent-soft': 'Glut, ganz hell: Flächen hinter einem Akzent.',
  fill: 'Glut: die eine Handlung einer Fläche (Button, Sitz belegt).',
  'fill-strong': 'Glut, dunkel: die Handlung beim Darüberfahren.',
  'on-fill': 'Schrift auf Glut.',
  spark: 'Funke: Plakatwort, Ziffern und Stempel auf Wald und Moos. Nie Schrift auf Papier.',
  line: 'Linie: ruhige Struktur zwischen Zeilen.',
  'line-strong': 'Linie, kräftiger: Ringe, Regeln über Fakten.',
  'line-bold': 'Kontur von Feldern und Bedienelementen (≥ 3:1).',
  success: 'Nur für Zustände, immer mit Worten.',
  danger: 'Nur für Zustände, immer mit Worten.',
};

/** The grounds, in the order a page uses them. */
export const GROUNDS = [
  { name: 'Papier', surface: 'default', text: 'Die Seite. Offen, viel Luft.' },
  { name: 'Sand', surface: 'alt', text: 'Ein Band für Zusammengehöriges.' },
  { name: 'Moos', surface: 'moss', text: 'Was im Kreis gesprochen wird: Absprachen, Stimmen.' },
  { name: 'Wald', surface: 'dark', text: 'Was hineinzieht: Eröffnung, Anmeldung, Fuß.' },
] as const;

/** Type roles by name (`--text-<name>`): the face and what they set. */
export const TYPE_USE: Record<string, { face: 'display' | 'sans'; use: string; sample: string }> = {
  poster: { face: 'display', use: 'Ein Wort oder eine Zahl, groß wie auf einem Plakat', sample: 'Dabei sein.' },
  hero: { face: 'display', use: 'Die Aussage der Startseite', sample: 'Ein Abend, an dem du nichts darstellen musst.' },
  index: { face: 'display', use: 'Ziffer in der Marginalspalte', sample: '01' },
  page: { face: 'display', use: 'Titel einer Unterseite', sample: 'Termine und Anmeldung' },
  section: { face: 'display', use: 'Titel einer Sektion', sample: 'Wie ein Abend abläuft' },
  sub: { face: 'display', use: 'Zwischentitel, Werte, Daten', sample: 'Freitag, 20. November 2026' },
  quote: { face: 'display', use: 'Ein kurzes Zitat', sample: 'Ich sorge dafür, dass jeder in Ruhe sprechen kann.' },
  xl: { face: 'sans', use: 'FAQ-Fragen, Datenwerte', sample: 'Muss ich etwas erzählen?' },
  lg: {
    face: 'sans',
    use: 'Einleitung',
    sample: 'Wir sitzen im Kreis und sprechen über das, was uns gerade beschäftigt.',
  },
  md: { face: 'sans', use: 'Fließtext', sample: 'Wer spricht, hat die ganze Aufmerksamkeit der anderen.' },
  base: { face: 'sans', use: 'Buttons, Felder, Daten', sample: 'Zur Anmeldung' },
  sm: { face: 'sans', use: 'Labels, Hinweise', sample: 'Nächster Termin' },
  marginal: { face: 'sans', use: 'Notiz in der Marginalspalte', sample: 'Kein Ersatz für Therapie.' },
  xs: { face: 'sans', use: 'Kleingedrucktes', sample: '© Männerkreis Niederbayern' },
};
