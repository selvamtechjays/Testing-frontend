import { createContext } from 'react';
import type { Task } from '../api/types';

/** Which body the task list shows. */
export type ListStatus = 'loading' | 'empty' | 'populated' | 'loadFailed';

export interface TasksValue {
  tasks: Task[];
  status: ListStatus;
  /** Shows the task at the top at once and saves in the background; resolves false if the save failed. */
  addTask: (title: string) => Promise<boolean>;
  /** Ticks a Pending task or unticks a Completed one; the row keeps its place. */
  toggleStatus: (id: string) => Promise<boolean>;
  /** Changes the title at once and saves it; a failed save restores the stored title. */
  editTitle: (id: string, title: string) => Promise<boolean>;
  /** Removes the task at once and offers Undo for 5 seconds; the delete is sent when the window ends. */
  startDelete: (id: string) => Promise<boolean>;
  /** Puts the pending deletion back, in its place, without any request. */
  undoDelete: () => void;
  /** True while a deletion is inside its Undo window. */
  deletePending: boolean;
}

export const TasksContext = createContext<TasksValue | null>(null);
