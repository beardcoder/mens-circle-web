/**
 * Shared copy for the breathing exercise, used by both src/pages/atemuebung.astro
 * and the standalone app's info dialog in components/BreathingExperience.astro.
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
