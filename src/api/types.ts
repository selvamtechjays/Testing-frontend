export type TaskStatus = 'pending' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

/** Low, Medium, High in the order the screen offers them. */
export const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];

/** The six chip colours a tag can have (shared contract, section 8 of the plan). */
export const TAG_COLOURS = ['gray', 'red', 'orange', 'green', 'blue', 'purple'] as const;
export type TagColour = (typeof TAG_COLOURS)[number];

/** A tag as a task carries it. */
export interface TaskTag {
  id: string;
  name: string;
  colour: TagColour;
}

/** A tag as the tag operations return it: with how many of the user's tasks carry it. */
export interface Tag extends TaskTag {
  taskCount: number;
}

/** One task as the API returns it (shared contract, section 8 of the plan). */
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  /** A calendar date, YYYY-MM-DD, with no time or zone; null when the task has none. */
  dueDate: string | null;
  priority: TaskPriority;
  /** One optional plain-text note, at most 1000 characters; null when the task has none (Task-24). */
  notes: string | null;
  /** The task's tags, sorted by name ignoring case; empty when it has none (Task-26). */
  tags: TaskTag[];
}

/** What the list can be narrowed by and sorted on (EP-TASK-01). The first value of each is "no filter". */
export type StatusFilter = 'all' | TaskStatus;
export type PriorityFilter = 'all' | TaskPriority;
export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';
export type SortOrder = 'newest' | 'due' | 'priority';
/** One tag by id, or 'none' for tasks with no tags; 'any' is no tag filter (task-tags). */
export type TagFilter = 'any' | 'none' | (string & {});

export interface ListFilters {
  status: StatusFilter;
  priority: PriorityFilter;
  due: DueFilter;
  sort: SortOrder;
  tag: TagFilter;
}

/** No narrowing and newest first; a choice equal to its default is never sent. */
export const DEFAULT_FILTERS: ListFilters = {
  status: 'all',
  priority: 'all',
  due: 'any',
  sort: 'newest',
  tag: 'any',
};
