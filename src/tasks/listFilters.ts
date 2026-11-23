import {
  DEFAULT_FILTERS,
  type DueFilter,
  type ListFilters,
  type PriorityFilter,
  type SortOrder,
  type StatusFilter,
  type TagFilter,
} from '../api/types';
import {
  DUE_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from './filterOptions';

export { DEFAULT_FILTERS };

// The accepted values are the filter bar's own options, so the two cannot drift apart.
const STATUSES = STATUS_OPTIONS.map((option) => option.value);
const PRIORITY_FILTERS = PRIORITY_FILTER_OPTIONS.map((option) => option.value);
const DUES = DUE_OPTIONS.map((option) => option.value);
const SORTS = SORT_OPTIONS.map((option) => option.value);

/** A tag id as the server mints them: 24 hex characters. */
const TAG_ID = /^[0-9a-f]{24}$/;

/** True for a filter value that names one tag by id rather than Any or No tags. */
export function isTagId(tag: TagFilter): boolean {
  return TAG_ID.test(tag);
}

/** True when any of the five differs from its default: the list on screen is narrowed or reordered. */
export function filtersActive(filters: ListFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as Array<keyof ListFilters>).some(
    (key) => filters[key] !== DEFAULT_FILTERS[key],
  );
}

/**
 * True when status, priority, due or tag differs from its default: the list on screen is narrowed.
 * Sort alone never narrows, so it does not count here.
 */
export function filtersNarrowing(filters: ListFilters): boolean {
  return (
    filters.status !== DEFAULT_FILTERS.status ||
    filters.priority !== DEFAULT_FILTERS.priority ||
    filters.due !== DEFAULT_FILTERS.due ||
    filters.tag !== DEFAULT_FILTERS.tag
  );
}

/** Where this user's choices live on this device (DEC-217). Search text is never stored. */
export function filtersKey(userId: string): string {
  return `tasknest-filters:${userId}`;
}

type Stored = Partial<Record<keyof ListFilters, unknown>>;

/** A tag from before tags existed, or one that is not Any, No tags or an id, reads as Any with no message. */
function rememberedTag(tag: unknown): TagFilter {
  return typeof tag === 'string' && (tag === 'none' || TAG_ID.test(tag)) ? tag : 'any';
}

/** The stored choices when every one is in range; any one out of range means the record is not trusted. */
function trusted(stored: Stored): ListFilters | null {
  const { status, priority, due, sort, tag } = stored;
  if (
    !STATUSES.includes(status as StatusFilter) ||
    !PRIORITY_FILTERS.includes(priority as PriorityFilter) ||
    !DUES.includes(due as DueFilter) ||
    !SORTS.includes(sort as SortOrder)
  ) {
    return null;
  }
  return { status, priority, due, sort, tag: rememberedTag(tag) } as ListFilters;
}

/** The stored choices for this user, or the defaults when nothing usable is there. Never throws. */
export function loadFilters(userId: string | undefined): ListFilters {
  if (userId === undefined) return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(filtersKey(userId));
    if (raw === null) return DEFAULT_FILTERS;
    const stored = JSON.parse(raw) as Stored | null;
    if (typeof stored !== 'object' || stored === null) return DEFAULT_FILTERS;
    return trusted(stored) ?? DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

/** Remembers the choices for this user. A blocked or full store is ignored: the page still works. */
export function saveFilters(userId: string | undefined, filters: ListFilters): void {
  if (userId === undefined) return;
  // Only the five choices are remembered, whatever the caller hands in: search text never is (AC-12).
  const { status, priority, due, sort, tag } = filters;
  try {
    window.localStorage.setItem(
      filtersKey(userId),
      JSON.stringify({ status, priority, due, sort, tag }),
    );
  } catch {
    // Remembering is a convenience; losing it must never break the list.
  }
}
