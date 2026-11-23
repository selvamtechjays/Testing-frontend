import { createContext } from 'react';
import type { TagChanges } from '../api/tags';
import type { NewTask } from '../api/tasks';
import type { ListFilters, Tag, Task, TaskPriority } from '../api/types';

/** How the user's tag list stands: the first load, done, or failed. */
export type TagsStatus = 'loading' | 'ready' | 'failed';

/** What a tag creation from the picker came to; `message` is the server's reason, shown beside the field. */
export interface CreateTagResult {
  ok: boolean;
  message?: string;
}

/** What a rename or recolour came to: done, refused with the server's reason, or the tag was already gone. */
export type UpdateTagResult = { ok: true } | { ok: false; message?: string; notFound?: boolean };

/** What a tag delete came to; `notFound` means it was already gone elsewhere. */
export interface DeleteTagResult {
  ok: boolean;
  notFound?: boolean;
}

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
  /** The status, priority, due, tag and sort choices; they apply at once and are remembered per user. */
  filters: ListFilters;
  /** Changes one choice: the list reloads at once and the choice is remembered. */
  setFilter: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  /** Back to the defaults; the search text is kept. */
  clearFilters: () => void;
  /** True when the list on screen is the result of a non-default status, priority, due or tag filter (sort alone narrows nothing). */
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
  /** The user's tags with task counts, sorted by name; one list feeds the picker, filter and panel. */
  tags: Tag[];
  tagsStatus: TagsStatus;
  /** Reads the tag list again, quietly: a failure leaves the list as it is. */
  refreshTags: () => Promise<void>;
  /** Sets the task's whole tag list at once and saves it; a failed save restores the stored tags. */
  changeTags: (id: string, tagIds: string[]) => Promise<boolean>;
  /** Ticks the tag with this name (matched ignoring case) or creates it gray and ticks it. */
  createTagAndTick: (taskId: string, name: string) => Promise<CreateTagResult>;
  /** Renames or recolours a tag; nothing changes on screen until the server accepts. */
  updateTag: (id: string, changes: TagChanges) => Promise<UpdateTagResult>;
  /** Deletes a tag from every task; the screen changes only after the server confirms. */
  deleteTag: (id: string) => Promise<DeleteTagResult>;
  /** How many tasks carry the tag, read from the server now, for the delete question. */
  freshTaskCount: (id: string) => Promise<number | null>;
  /** Sets the Tag filter to this tag (a chip was chosen), keeping the search and the other filters. */
  selectTag: (id: string) => void;
  /** A tag was deleted: when it is the Tag filter the filter returns to Any and the list reloads. */
  tagDeleted: (id: string) => void;
  /** Removes the task at once and offers Undo for 5 seconds; the delete is sent when the window ends. */
  startDelete: (id: string) => Promise<boolean>;
  /** Puts the pending deletion back, in its place, without any request. */
  undoDelete: () => void;
  /** True while a deletion is inside its Undo window. */
  deletePending: boolean;
}

export const TasksContext = createContext<TasksValue | null>(null);
