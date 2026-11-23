// tier: unit
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ListFilters } from '../api/types';
import {
  DEFAULT_FILTERS,
  filtersActive,
  filtersNarrowing,
  filtersKey,
  isTagId,
  loadFilters,
  saveFilters,
} from './listFilters';
import {
  DUE_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  tagFilterOptions,
} from './filterOptions';
import { buildTag } from '../test/mocks/tags';

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
    const chosen = {
      status: 'pending',
      priority: 'high',
      due: 'week',
      sort: 'due',
      tag: 'none',
    } as const;
    saveFilters('u1', chosen);
    expect(window.localStorage.getItem('tasknest-filters:u1')).toBe(JSON.stringify(chosen));
    expect(loadFilters('u1')).toEqual(chosen);
  });

  it('keeps two users on one browser apart (AC-12)', () => {
    saveFilters('u1', { ...DEFAULT_FILTERS, sort: 'due' });
    expect(loadFilters('u2')).toEqual(DEFAULT_FILTERS);
    expect(filtersKey('u2')).toBe('tasknest-filters:u2');
  });

  it('stores only the five choices, never search text, even if handed more (AC-12)', () => {
    const withSearch = { ...DEFAULT_FILTERS, search: 'milk' } as unknown as ListFilters;
    saveFilters('u1', withSearch);
    const stored = JSON.parse(window.localStorage.getItem('tasknest-filters:u1') ?? '{}');
    expect(Object.keys(stored).sort()).toEqual(['due', 'priority', 'sort', 'status', 'tag']);
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

const TAG_ID = 'a1b2c3d4e5f60718293a4b5c';

describe('the Tag filter (FEAT-TAG-04 AC-5 AC-6 AC-16 BR-5 BR-6)', () => {
  it('counts as active and as narrowing, even when it is the only choice (TAG04 AC-5)', () => {
    for (const tag of ['none', TAG_ID]) {
      expect(filtersActive({ ...DEFAULT_FILTERS, tag })).toBe(true);
      expect(filtersNarrowing({ ...DEFAULT_FILTERS, tag })).toBe(true);
    }
    expect(DEFAULT_FILTERS.tag).toBe('any');
  });

  it('recognises a tag id by its 24 hex characters only (TAG04 AC-16)', () => {
    expect(isTagId(TAG_ID)).toBe(true);
    expect(isTagId('none')).toBe(false);
    expect(isTagId('any')).toBe(false);
    expect(isTagId('A1B2C3D4E5F60718293A4B5C')).toBe(false);
  });

  it('remembers Any, No tags and a tag id across a reload (TAG04 AC-6)', () => {
    for (const tag of ['any', 'none', TAG_ID]) {
      saveFilters('u1', { ...DEFAULT_FILTERS, tag });
      expect(loadFilters('u1').tag).toBe(tag);
    }
  });

  it('reads a stored value from before tags existed as Any, keeping the other choices (TAG04 AC-16)', () => {
    window.localStorage.setItem(
      'tasknest-filters:u1',
      JSON.stringify({ status: 'pending', priority: 'all', due: 'any', sort: 'due' }),
    );
    expect(loadFilters('u1')).toEqual({ ...DEFAULT_FILTERS, status: 'pending', sort: 'due' });
  });

  it.each([5, null, 'work', '<img src=x>', 'A1B2C3D4E5F60718293A4B5C'])(
    'reads a stored tag of %s as Any with the other choices kept (TAG04 AC-16)',
    (tag) => {
      window.localStorage.setItem(
        'tasknest-filters:u1',
        JSON.stringify({ status: 'completed', priority: 'all', due: 'any', sort: 'newest', tag }),
      );
      expect(loadFilters('u1')).toEqual({ ...DEFAULT_FILTERS, status: 'completed' });
    },
  );

  it('offers Any, No tags, then each tag by its name in the order given (TAG04 AC-4 AC-20)', () => {
    expect(tagFilterOptions([]).map((o) => o.label)).toEqual(['Any', 'No tags']);
    const tags = [buildTag({ id: 'e', name: 'Errands' }), buildTag({ id: 'w', name: 'Work' })];
    expect(tagFilterOptions(tags)).toEqual([
      { value: 'any', label: 'Any' },
      { value: 'none', label: 'No tags' },
      { value: 'e', label: 'Errands' },
      { value: 'w', label: 'Work' },
    ]);
  });
});
