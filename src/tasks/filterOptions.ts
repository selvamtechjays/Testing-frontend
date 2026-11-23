import type {
  DueFilter,
  PriorityFilter,
  SortOrder,
  StatusFilter,
  Tag,
  TagFilter,
} from '../api/types';
import type { SelectOption } from '../components/SelectField';
import { copy } from '../copy';

/** The filter bar's choice lists; the remembered-filter check reads the same arrays. */
export const STATUS_OPTIONS: Array<SelectOption<StatusFilter>> = [
  { value: 'all', label: copy.filterAll },
  { value: 'pending', label: copy.statusOptionPending },
  { value: 'completed', label: copy.statusOptionCompleted },
];

export const PRIORITY_FILTER_OPTIONS: Array<SelectOption<PriorityFilter>> = [
  { value: 'all', label: copy.filterAll },
  { value: 'high', label: copy.priorityHigh },
  { value: 'medium', label: copy.priorityMedium },
  { value: 'low', label: copy.priorityLow },
];

export const DUE_OPTIONS: Array<SelectOption<DueFilter>> = [
  { value: 'any', label: copy.dueAny },
  { value: 'overdue', label: copy.dueOptionOverdue },
  { value: 'today', label: copy.dueOptionToday },
  { value: 'week', label: copy.dueOptionWeek },
  { value: 'none', label: copy.dueOptionNone },
];

export const SORT_OPTIONS: Array<SelectOption<SortOrder>> = [
  { value: 'newest', label: copy.sortNewest },
  { value: 'due', label: copy.sortDue },
  { value: 'priority', label: copy.sortPriority },
];

/** The Tag select: Any, No tags, then one option per tag by name (the tags arrive sorted by name). */
export function tagFilterOptions(tags: Tag[]): Array<SelectOption<TagFilter>> {
  return [
    { value: 'any', label: copy.tagFilterAny },
    { value: 'none', label: copy.tagFilterNone },
    ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
  ];
}
