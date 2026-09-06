/**
 * Week helpers. All report weeks run Monday -> Sunday and are handled as
 * date-only values at UTC midnight so they are unambiguous in the database.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Parse "YYYY-MM-DD" into a Date at UTC midnight. Throws on invalid input. */
export function parseDateOnly(value: string): Date {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toDateOnlyString(date) !== value) {
    throw new Error(`Invalid date "${value}"`);
  }
  return date;
}

export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/** Monday (UTC midnight) of the week containing the given date. */
export function startOfWeek(date: Date): Date {
  const utcMidnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (utcMidnight.getUTCDay() + 6) % 7;
  return addDays(utcMidnight, -daysSinceMonday);
}

/** Sunday of the week that starts on the given Monday. */
export function endOfWeek(weekStart: Date): Date {
  return addDays(weekStart, 6);
}

export function currentWeekStart(now: Date = new Date()): Date {
  return startOfWeek(now);
}

export function isMonday(date: Date): boolean {
  return date.getUTCDay() === 1;
}

/**
 * Reports are due by the end of the Monday following the reporting week.
 * A report first submitted after this moment counts as "late".
 */
export function submissionDeadline(weekEnd: Date): Date {
  return new Date(addDays(weekEnd, 2).getTime() - 1);
}

/** Human readable label such as "Aug 31 - Sep 6, 2026". */
export function formatWeekLabel(weekStart: Date): string {
  const end = endOfWeek(weekStart);
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt.format(weekStart)} - ${fmt.format(end)}, ${end.getUTCFullYear()}`;
}
