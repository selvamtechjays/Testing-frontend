// tier: unit
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ListFilters } from '../api/types';
import {
  DEFAULT_FILTERS,
  filtersActive,
  filtersNarrowing,
  filtersKey,
  loadFilters,
  saveFilters,
} from './listFilters';
import {
  DUE_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from './filterOptions';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('filtersActive', () => {
  it('is false for the defaults (AC-11)', () => {
    expect(filtersActive(DEFAULT_FILTERS)).toBe(false);
  });
  it.each([
    { status: 'pending' },
    { priority: 'high' },
    { due: 'overdue' },
    { sort: 'due' },
  ] as const)('is true when %o differs (AC-11)', (change) => {
    expect(filtersActive({ ...DEFAULT_FILTERS, ...change })).toBe(true);
  });
});

describe('filtersNarrowing', () => {
  it('is false for the defaults and for a sort alone, which narrows nothing (BLT-sort-not-narrowing)', () => {
    expect(filtersNarrowing(DEFAULT_FILTERS)).toBe(false);
    expect(filtersNarrowing({ ...DEFAULT_FILTERS, sort: 'due' })).toBe(false);
  });
  it.each([{ status: 'pending' }, { priority: 'high' }, { due: 'overdue' }] as const)(
    'is true when %o differs (BLT-sort-not-narrowing)',
    (change) => {
      expect(filtersNarrowing({ ...DEFAULT_FILTERS, ...change })).toBe(true);
    },
  );
});

describe('the remembered-filter check and the filter bar share their options (BLT-filter-lists)', () => {
  it.each([
    ['status', STATUS_OPTIONS],
    ['priority', PRIORITY_FILTER_OPTIONS],
    ['due', DUE_OPTIONS],
    ['sort', SORT_OPTIONS],
  ] as const)('accepts every %s option the bar offers', (key, options) => {
    for (const option of options) {
      saveFilters('u1', { ...DEFAULT_FILTERS, [key]: option.value });
      expect(loadFilters('u1')).toEqual({ ...DEFAULT_FILTERS, [key]: option.value });
    }
  });
});

describe('loadFilters and saveFilters (DEC-217)', () => {
  it('round-trips the choices under tasknest-filters:<userId> (AC-12)', () => {
    const chosen = { status: 'pending', priority: 'high', due: 'week', sort: 'due' } as const;
    saveFilters('u1', chosen);
    expect(window.localStorage.getItem('tasknest-filters:u1')).toBe(JSON.stringify(chosen));
    expect(loadFilters('u1')).toEqual(chosen);
  });

  it('keeps two users on one browser apart (AC-12)', () => {
    saveFilters('u1', { ...DEFAULT_FILTERS, sort: 'due' });
    expect(loadFilters('u2')).toEqual(DEFAULT_FILTERS);
    expect(filtersKey('u2')).toBe('tasknest-filters:u2');
  });

  it('stores only the four choices, never search text, even if handed more (AC-12)', () => {
    const withSearch = { ...DEFAULT_FILTERS, search: 'milk' } as unknown as ListFilters;
    saveFilters('u1', withSearch);
    const stored = JSON.parse(window.localStorage.getItem('tasknest-filters:u1') ?? '{}');
    expect(Object.keys(stored).sort()).toEqual(['due', 'priority', 'sort', 'status']);
  });

  it.each([
    'not json',
    '{"status":"pending"}',
    '{"status":"x","priority":"all","due":"any","sort":"newest"}',
    'null',
    '5',
  ])('falls back to the defaults for an unusable value %s (AC-12)', (raw) => {
    window.localStorage.setItem('tasknest-filters:u1', raw);
    expect(loadFilters('u1')).toEqual(DEFAULT_FILTERS);
  });

  it('falls back to the defaults when storage throws, and saving does not throw (AC-12)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(loadFilters('u1')).toEqual(DEFAULT_FILTERS);
    expect(() => saveFilters('u1', DEFAULT_FILTERS)).not.toThrow();
  });

  it('does nothing without a user id', () => {
    saveFilters(undefined, { ...DEFAULT_FILTERS, sort: 'due' });
    expect(window.localStorage.length).toBe(0);
    expect(loadFilters(undefined)).toEqual(DEFAULT_FILTERS);
  });
});
