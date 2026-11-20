import { createContext } from 'react';
import type { NewTask } from '../api/tasks';
import type { ListFilters, Task, TaskPriority } from '../api/types';

/** Which body the task list shows. */
export type ListStatus =
  'loading' | 'empty' | 'populated' | 'loadFailed' | 'noMatch' | 'searchFailed';

export interface TasksValue {
  tasks: Task[];
  status: ListStatus;
  /** The search box's current text; updates on every keystroke. */
  search: string;
  /** Sets the box's text; the list follows 300 ms after the last keystroke. */
  setSearch: (text: string) => void;
  /** Runs the current query again after a failed search. */
  retrySearch: () => void;
  /** True while a request is in flight after the first load; the list stays on screen. */
  searching: boolean;
  /** True when the list on screen is the result of a non-empty search. */
  searchApplied: boolean;
  /** The status, priority, due and sort choices; they apply at once and are remembered per user. */
  filters: ListFilters;
  /** Changes one choice: the list reloads at once and the choice is remembered. */
  setFilter: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  /** Back to the defaults; the search text is kept. */
  clearFilters: () => void;
  /** True when the list on screen is the result of a non-default status, priority or due filter (sort alone narrows nothing). */
  filtersApplied: boolean;
  /** The user's own calendar date, YYYY-MM-DD, as of the last request. */
  today: string;
  /** How many of the user's pending tasks are overdue, whatever filters or search are on. */
  overdueCount: number;
  /** Shows the task at the top at once and saves in the background; resolves false if the save failed. */
  addTask: (input: NewTask) => Promise<boolean>;
  /** Ticks a Pending task or unticks a Completed one; the row keeps its place. */
  toggleStatus: (id: string) => Promise<boolean>;
  /** Changes the title at once and saves it; a failed save restores the stored title. */
  editTitle: (id: string, title: string) => Promise<boolean>;
  /** Changes the due date (null clears it) at once and saves it; a failed save restores the stored date. */
  changeDueDate: (id: string, dueDate: string | null) => Promise<boolean>;
  /** Changes the priority at once and saves it; a failed save restores the stored priority. */
  changePriority: (id: string, priority: TaskPriority) => Promise<boolean>;
  /** Changes the notes (null clears them) at once and saves them; a failed save restores the stored notes. */
  changeNotes: (id: string, notes: string | null) => Promise<boolean>;
  /** Removes the task at once and offers Undo for 5 seconds; the delete is sent when the window ends. */
  startDelete: (id: string) => Promise<boolean>;
  /** Puts the pending deletion back, in its place, without any request. */
  undoDelete: () => void;
  /** True while a deletion is inside its Undo window. */
  deletePending: boolean;
}

export const TasksContext = createContext<TasksValue | null>(null);
