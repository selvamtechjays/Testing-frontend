import { apiFetch } from './client';
import { localToday } from '../lib/localDate';
import {
  DEFAULT_FILTERS,
  type ListFilters,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from './types';

/** Fields a PATCH may carry; at least one is required by the server. */
export interface TaskPatch {
  title?: string;
  status?: TaskStatus;
  /** A calendar date, or null to clear it. */
  dueDate?: string | null;
  priority?: TaskPriority;
}

/** What a new task is made from; a missing date and priority mean no date and Medium. */
export interface NewTask {
  title: string;
  dueDate?: string | null;
  priority?: TaskPriority;
}

export interface ListTasksOptions {
  /** Title text to search for; empty or spaces only means no search. */
  search?: string;
  /** Status, priority, due and sort choices; only the ones that are not the default are sent. */
  filters?: ListFilters;
  /** The caller's own calendar date. Always sent: the server never uses its own clock (DEC-218). */
  today?: string;
  signal?: AbortSignal;
}

/** What the list call returns: the tasks, and the count of overdue pending tasks (EP-TASK-01). */
export interface TaskListResult {
  tasks: Task[];
  overdueCount?: number;
}

/** A task as the server sent it: an older API, or a row written before Task-23, may lack the two fields. */
type WireTask = Omit<Task, 'dueDate' | 'priority'> & Partial<Pick<Task, 'dueDate' | 'priority'>>;

/**
 * Every task enters the app through here, so a missing due date reads as none and a missing
 * priority as Medium (the same rule the server applies to older rows, DEC-210). A field the
 * server left out must never crash the list.
 */
export function toTask(wire: WireTask): Task {
  return { ...wire, dueDate: wire.dueDate ?? null, priority: wire.priority ?? 'medium' };
}

/**
 * GET /api/tasks (EP-TASK-01). The server returns the signed-in user's tasks, narrowed and ordered
 * by the filters, and the title search when there is text. `today` goes on every call.
 */
export async function listTasks(options: ListTasksOptions = {}): Promise<TaskListResult> {
  const params = new URLSearchParams();
  const text = options.search?.trim() ?? '';
  if (text !== '') params.set('search', text);
  const filters = options.filters ?? DEFAULT_FILTERS;
  for (const key of Object.keys(DEFAULT_FILTERS) as Array<keyof ListFilters>) {
    if (filters[key] !== DEFAULT_FILTERS[key]) params.set(key, filters[key]);
  }
  params.set('today', options.today ?? localToday());
  const result = await apiFetch<{ tasks: WireTask[]; overdueCount?: number }>(
    `/tasks?${params.toString()}`,
    { signal: options.signal },
  );
  return { ...result, tasks: result.tasks.map(toTask) };
}

/** POST /api/tasks (EP-TASK-02). Resolves with the stored task; rejects with ApiError otherwise. */
export async function createTask(input: NewTask, signal?: AbortSignal): Promise<{ task: Task }> {
  const { task } = await apiFetch<{ task: WireTask }>('/tasks', {
    method: 'POST',
    body: input,
    signal,
  });
  return { task: toTask(task) };
}

/** PATCH /api/tasks/:id (EP-TASK-03). Used for tick, untick and edits of the title, due date and priority. */
export async function updateTask(
  id: string,
  patch: TaskPatch,
  signal?: AbortSignal,
): Promise<{ task: Task }> {
  const { task } = await apiFetch<{ task: WireTask }>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    signal,
  });
  return { task: toTask(task) };
}

export interface DeleteOptions {
  signal?: AbortSignal;
  /** Lets the request finish while the page unloads (the pagehide flush); `sendBeacon` cannot DELETE. */
  keepalive?: boolean;
}

/** DELETE /api/tasks/:id (EP-TASK-04). 204 with no body. */
export async function deleteTask(id: string, options: DeleteOptions = {}): Promise<void> {
  await apiFetch<null>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal: options.signal,
    keepalive: options.keepalive,
    // A flush during unload has nobody left to sign out or route, so it never fires the 401 handler.
    handleUnauthorized: options.keepalive ? false : undefined,
  });
}
