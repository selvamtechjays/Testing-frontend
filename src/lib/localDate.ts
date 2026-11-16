import type { Task } from '../api/types';

/**
 * Calendar dates here are YYYY-MM-DD strings end to end (DEC-214). A date has no instant, so it
 * is never built from or turned into a Date in the user's zone: nothing here uses toISOString.
 */

/** A UTC midnight for the parts; Date.UTC alone would read years 0 to 99 as 19xx. */
function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

const pad = (value: number, width: number) => String(value).padStart(width, '0');

/** Today on the user's own calendar, from the local year, month and day. */
export function localToday(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}

/** The date `years` ahead of a calendar date, by UTC arithmetic so no zone can move it. */
export function addYears(date: string, years: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const moved = utcDate(year + years, month, day);
  return `${pad(moved.getUTCFullYear(), 4)}-${pad(moved.getUTCMonth() + 1, 2)}-${pad(moved.getUTCDate(), 2)}`;
}

/** The furthest date the date pickers offer: today plus five years (DEC-211). */
export function maxDueDate(today: string): string {
  return addYears(today, 5);
}

/**
 * True when a typed date is later than `max`. Compared by length first because a native date box
 * accepts years past 9999, and as text "20266-01-01" would sort before "2031-01-01".
 */
export function isBeyondMax(date: string, max: string): boolean {
  return date.length > max.length || (date.length === max.length && date > max);
}

export type DueState = 'overdue' | 'today' | null;

/**
 * Overdue is a pending task due before today; Due today is any task due today; everything else,
 * including a completed task past its date, has no warning state (BR: completed is never overdue).
 */
export function dueState(task: Pick<Task, 'status' | 'dueDate'>, today: string): DueState {
  if (task.dueDate === null) return null;
  if (task.dueDate === today) return 'today';
  return task.status === 'pending' && task.dueDate < today ? 'overdue' : null;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** "Nov 20, 2026", read from the date's own parts and formatted in UTC so the day cannot shift. */
export function formatDueDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return DATE_FORMAT.format(utcDate(year, month, day));
}
