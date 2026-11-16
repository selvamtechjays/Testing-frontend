export type TaskStatus = 'pending' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

/** Low, Medium, High in the order the screen offers them. */
export const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];

/** One task as the API returns it (shared contract, section 8 of the plan). */
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  /** A calendar date, YYYY-MM-DD, with no time or zone; null when the task has none. */
  dueDate: string | null;
  priority: TaskPriority;
}

/** What the list can be narrowed by and sorted on (EP-TASK-01). The first value of each is "no filter". */
export type StatusFilter = 'all' | TaskStatus;
export type PriorityFilter = 'all' | TaskPriority;
export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';
export type SortOrder = 'newest' | 'due' | 'priority';

export interface ListFilters {
  status: StatusFilter;
  priority: PriorityFilter;
  due: DueFilter;
  sort: SortOrder;
}

/** No narrowing and newest first; a choice equal to its default is never sent. */
export const DEFAULT_FILTERS: ListFilters = {
  status: 'all',
  priority: 'all',
  due: 'any',
  sort: 'newest',
};
