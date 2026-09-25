/** Minimal 5-field cron matcher (`minute hour day-of-month month day-of-week`), evaluated against the UTC clock. */

/** A single cron field, e.g. a star, a step expression or a comma list. */
function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  return field.split(',').some((part) => {
    const step = part.match(/^\*\/(\d+)$/);
    if (step) return value % Number(step[1]) === 0;
    return Number(part) === value;
  });
}

/** A standard 5-field cron expression: `minute hour dom month dow`. */
export interface CronExpression {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

/** Parses a 5-field cron expression string into its named fields. */
export function parseCron(expression: string): CronExpression {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`cron expression must have 5 fields, got ${parts.length}: "${expression}"`);
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [string, string, string, string, string];
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

/** Whether `at` falls on a minute the expression selects. */
export function isDue(expression: string, at: Date): boolean {
  const cron = parseCron(expression);
  return (
    fieldMatches(cron.minute, at.getUTCMinutes()) &&
    fieldMatches(cron.hour, at.getUTCHours()) &&
    fieldMatches(cron.dayOfMonth, at.getUTCDate()) &&
    fieldMatches(cron.month, at.getUTCMonth() + 1) &&
    fieldMatches(cron.dayOfWeek, at.getUTCDay())
  );
}
