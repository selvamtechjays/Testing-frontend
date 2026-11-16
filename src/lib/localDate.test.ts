// tier: unit
import { describe, expect, it } from 'vitest';
import {
  addYears,
  dueState,
  formatDueDate,
  isBeyondMax,
  localToday,
  maxDueDate,
} from './localDate';

describe('setup guard: the test process zone', () => {
  it('setup guard: the test process runs west of UTC, so a local evening is already the next day in UTC', () => {
    const evening = new Date(2026, 10, 16, 23, 30);
    expect(evening.getUTCDate()).toBe(17);
    expect(evening.toISOString().slice(0, 10)).toBe('2026-11-17');
  });
});

describe('localToday', () => {
  it('reads the local year, month and day, padded (AC-9 DEC-214)', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localToday(new Date(2026, 10, 16, 0, 0))).toBe('2026-11-16');
  });

  it('follows the local calendar at the edges of the day, never the UTC fields (AC-9)', () => {
    expect(localToday(new Date(2026, 10, 16, 23, 30))).toBe('2026-11-16');
    expect(localToday(new Date(2026, 10, 17, 0, 5))).toBe('2026-11-17');
  });

  it('is built from getFullYear, getMonth and getDate, not toISOString (AC-9 DEC-214)', () => {
    const fake = {
      getFullYear: () => 2030,
      getMonth: () => 1,
      getDate: () => 9,
      toISOString: () => {
        throw new Error('must not be used');
      },
    } as unknown as Date;
    expect(localToday(fake)).toBe('2030-02-09');
  });
});

describe('dueState', () => {
  const today = '2026-11-16';
  it('is overdue for a pending task due before today (AC-10)', () => {
    expect(dueState({ status: 'pending', dueDate: '2026-11-15' }, today)).toBe('overdue');
  });
  it('is never overdue for a completed task (AC-10)', () => {
    expect(dueState({ status: 'completed', dueDate: '2026-11-15' }, today)).toBeNull();
  });
  it('is today when the date is today, pending or completed (AC-10)', () => {
    expect(dueState({ status: 'pending', dueDate: today }, today)).toBe('today');
    expect(dueState({ status: 'completed', dueDate: today }, today)).toBe('today');
  });
  it('is null for a later date and for no date', () => {
    expect(dueState({ status: 'pending', dueDate: '2026-11-17' }, today)).toBeNull();
    expect(dueState({ status: 'pending', dueDate: null }, today)).toBeNull();
  });
});

describe('formatDueDate', () => {
  it('shows the stored day whatever the process time zone is (AC-9)', () => {
    expect(formatDueDate('2026-11-20')).toBe('Nov 20, 2026');
    expect(formatDueDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDueDate('2026-12-31')).toBe('Dec 31, 2026');
  });
});

describe('maxDueDate', () => {
  it('is today plus five years (DEC-211)', () => {
    expect(maxDueDate('2026-11-16')).toBe('2031-11-16');
  });
  it('rolls 29 February to 1 March in a year that has no 29th', () => {
    expect(addYears('2028-02-29', 5)).toBe('2033-03-01');
  });
});

describe('isBeyondMax (DEC-211)', () => {
  it('is true only for a date after the limit, the limit itself being allowed', () => {
    expect(isBeyondMax('2031-11-16', '2031-11-16')).toBe(false);
    expect(isBeyondMax('2031-11-17', '2031-11-16')).toBe(true);
    expect(isBeyondMax('2026-01-01', '2031-11-16')).toBe(false);
  });
  it('is true for a year past 9999, which sorts before the limit as plain text', () => {
    expect('20266-01-01' < '2031-11-16').toBe(true);
    expect(isBeyondMax('20266-01-01', '2031-11-16')).toBe(true);
  });
});
