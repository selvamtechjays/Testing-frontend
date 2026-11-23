import type { ListFilters, Tag } from '../api/types';
import { copy } from '../copy';
import { Button } from './Button';
import {
  DUE_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  tagFilterOptions,
} from '../tasks/filterOptions';
import type { Ref } from 'react';
import { SelectField } from './SelectField';
import './TaskFilterBar.css';

interface TaskFilterBarProps {
  filters: ListFilters;
  onChange: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  onClear: () => void;
  /** True when any choice differs from its default; Clear filters shows only then. */
  active: boolean;
  /** The user's tags, sorted by name: the Tag select's options after Any and No tags. */
  tags: Tag[];
  /** The Manage tags button: shown when given; it toggles the panel below the bar. */
  manage?: { open: boolean; onToggle: () => void; ref?: Ref<HTMLButtonElement> };
}

type ManageProps = NonNullable<TaskFilterBarProps['manage']>;

/** Clear filters (while a filter is active) and Manage tags (when the page offers it). */
function FilterActions({
  active,
  onClear,
  manage,
}: {
  active: boolean;
  onClear: () => void;
  manage?: ManageProps;
}) {
  if (!active && !manage) return null;
  return (
    <div className="task-filter-bar-actions">
      {active ? (
        <Button variant="secondary" onClick={onClear}>
          {copy.clearFilters}
        </Button>
      ) : null}
      {manage ? (
        <Button
          variant="secondary"
          ref={manage.ref}
          aria-expanded={manage.open}
          aria-controls={manage.open ? 'manage-tags-panel' : undefined}
          onClick={manage.onToggle}
        >
          {copy.manageTagsButton}
        </Button>
      ) : null}
    </div>
  );
}

/** Status, priority, due, sort and tag as labelled native selects; each change applies at once. */
export function TaskFilterBar({
  filters,
  onChange,
  onClear,
  active,
  tags,
  manage,
}: TaskFilterBarProps) {
  return (
    <div className="card task-filter-bar" role="group" aria-label={copy.filtersGroupLabel}>
      <div className="task-filter-bar-fields">
        <SelectField
          id="filter-status"
          label={copy.filterStatusLabel}
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(value) => onChange('status', value)}
        />
        <SelectField
          id="filter-priority"
          label={copy.filterPriorityLabel}
          value={filters.priority}
          options={PRIORITY_FILTER_OPTIONS}
          onChange={(value) => onChange('priority', value)}
        />
        <SelectField
          id="filter-due"
          label={copy.filterDueLabel}
          value={filters.due}
          options={DUE_OPTIONS}
          onChange={(value) => onChange('due', value)}
        />
        <SelectField
          id="filter-sort"
          label={copy.filterSortLabel}
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(value) => onChange('sort', value)}
        />
        <SelectField
          id="filter-tag"
          label={copy.filterTagLabel}
          value={filters.tag}
          options={tagFilterOptions(tags)}
          onChange={(value) => onChange('tag', value)}
        />
      </div>
      <FilterActions active={active} onClear={onClear} manage={manage} />
    </div>
  );
}
