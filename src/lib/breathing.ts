/**
 * Shared copy for the breathing exercise (Atemübung).
 *
 * The same instructions appear on the embedded page (src/pages/atemuebung.astro)
 * and in the standalone app's info dialog (components/BreathingExperience.astro).
 * Keeping them here is the single source of truth so the two surfaces can never
 * drift apart. Build-time only — plain data, no runtime/server imports.
 */

export interface BreathingStep {
  /** Bold lead-in, e.g. "Tief atmen". */
  title: string;
  /** The instruction that follows the title. */
  text: string;
}

export const BREATHING_STEPS: BreathingStep[] = [
  { title: 'Tief atmen', text: '35 kräftige Atemzüge — vollständig einatmen, locker ausatmen.' },
  { title: 'Halten', text: 'Nach der letzten Ausatmung den Atem so lange wie möglich anhalten.' },
  { title: 'Erholung', text: 'Tief einatmen und 15 Sekunden halten. Dann normal weiteratmen.' },
];

export const BREATHING_WARNING = 'Übe niemals im Wasser oder beim Autofahren. Setze oder lege dich entspannt hin.';
