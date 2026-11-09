/**
 * The brand templates: every format the circle prints or posts, with its size,
 * bleed and outputs. One list for the template pages (`src/pages/brand/[template].astro`),
 * the render script (`scripts/brand-render.ts`) and the styleguide. Print sizes are
 * the trimmed size in millimetres; screen sizes are pixels.
 */

export type TemplateId =
  | 'flyer-a6'
  | 'flyer-dl'
  | 'poster-a3'
  | 'card'
  | 'ig-square'
  | 'ig-portrait'
  | 'ig-story'
  | 'og-default'
  | 'og-markus'
  | 'logo-lockup';

export interface TemplateSpec {
  id: TemplateId;
  /** German name for people. */
  label: string;
  /** The trimmed size. */
  width: number;
  height: number;
  unit: 'mm' | 'px';
  /** Bleed on every side, in mm (print only). */
  bleed: number;
  /** Pages (front and back). */
  pages: number;
  outputs: ('pdf' | 'png')[];
  /** The ground the template opens on. */
  mode: 'light' | 'dark';
  /** Reads the coming dates. */
  needsEvents: boolean;
  /** A transparent PNG (the logo lockup). */
  transparent?: boolean;
}

const print = (
  id: TemplateId,
  label: string,
  width: number,
  height: number,
  extra: Partial<TemplateSpec> = {},
): TemplateSpec => ({
  id,
  label,
  width,
  height,
  unit: 'mm',
  bleed: 3,
  pages: 1,
  outputs: ['pdf', 'png'],
  mode: 'light',
  needsEvents: true,
  ...extra,
});

const screen = (
  id: TemplateId,
  label: string,
  width: number,
  height: number,
  extra: Partial<TemplateSpec> = {},
): TemplateSpec => ({
  id,
  label,
  width,
  height,
  unit: 'px',
  bleed: 0,
  pages: 1,
  outputs: ['png'],
  mode: 'dark',
  needsEvents: true,
  ...extra,
});

export const TEMPLATES: TemplateSpec[] = [
  print('flyer-a6', 'Flyer A6, Vorder- und Rückseite', 105, 148, { pages: 2 }),
  print('flyer-dl', 'Flyer DIN lang', 99, 210),
  print('poster-a3', 'Plakat A3', 297, 420),
  print('card', 'Visitenkarte, Vorder- und Rückseite', 85, 55, { pages: 2, bleed: 2, needsEvents: false }),
  screen('ig-square', 'Instagram-Beitrag 1:1', 1080, 1080),
  screen('ig-portrait', 'Instagram-Beitrag 4:5', 1080, 1350),
  screen('ig-story', 'Story 9:16', 1080, 1920),
  screen('og-default', 'Vorschaubild (Open Graph)', 1200, 630, { needsEvents: false }),
  screen('og-markus', 'Vorschaubild der persönlichen Seite', 1200, 630, { needsEvents: false, mode: 'light' }),
  screen('logo-lockup', 'Logo mit Wortmarke', 1600, 640, {
    needsEvents: false,
    mode: 'light',
    transparent: true,
    outputs: ['png', 'pdf'],
  }),
];

/** The size a template prints or renders at, bleed included, as CSS lengths. */
export const pageSize = (spec: TemplateSpec): { width: string; height: string } => ({
  width: `${spec.width + 2 * spec.bleed}${spec.unit}`,
  height: `${spec.height + 2 * spec.bleed}${spec.unit}`,
});
