import type { ListFilters } from '../api/types';
import { copy } from '../copy';
import { Button } from './Button';
import {
  DUE_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from '../tasks/filterOptions';
import { SelectField } from './SelectField';
import './TaskFilterBar.css';

interface TaskFilterBarProps {
  filters: ListFilters;
  onChange: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  onClear: () => void;
  /** True when any choice differs from its default; Clear filters shows only then. */
  active: boolean;
}

/** Status, priority, due and sort as labelled native selects; each change applies at once. */
export function TaskFilterBar({ filters, onChange, onClear, active }: TaskFilterBarProps) {
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
      </div>
      {active ? (
        <Button variant="secondary" className="task-filter-bar-clear" onClick={onClear}>
          {copy.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
