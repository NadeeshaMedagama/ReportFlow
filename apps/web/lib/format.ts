/**
 * Date / week helpers for the browser. Weeks run Monday -> Sunday and are
 * exchanged with the API as "YYYY-MM-DD" strings (the Monday).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse "YYYY-MM-DD" as UTC midnight. */
export function fromDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Monday of the week containing the given (local) date, as YYYY-MM-DD. */
export function mondayOf(date: Date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const daysSinceMonday = (utc.getUTCDay() + 6) % 7;
  return toDateOnly(new Date(utc.getTime() - daysSinceMonday * DAY_MS));
}

export function currentWeekStart(): string {
  return mondayOf(new Date());
}

export function addWeeks(weekStart: string, weeks: number): string {
  return toDateOnly(new Date(fromDateOnly(weekStart).getTime() + weeks * 7 * DAY_MS));
}

export function weekEndOf(weekStart: string): string {
  return toDateOnly(new Date(fromDateOnly(weekStart).getTime() + 6 * DAY_MS));
}

export function isMonday(value: string): boolean {
  return fromDateOnly(value).getUTCDay() === 1;
}

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const shortDateYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Aug 31 - Sep 6, 2026" */
export function formatWeek(weekStart: string): string {
  const start = fromDateOnly(weekStart);
  const end = fromDateOnly(weekEndOf(weekStart));
  return `${shortDate.format(start)} - ${shortDate.format(end)}, ${end.getUTCFullYear()}`;
}

/** Accepts either an ISO timestamp or a YYYY-MM-DD value. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = value.length === 10 ? fromDateOnly(value) : new Date(value);
  return shortDateYear.format(date);
}

const dateTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return dateTime.format(new Date(value));
}

export function formatRelative(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(value);
}

export function formatHours(hours: number): string {
  return `${Math.round(hours * 10) / 10} h`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
