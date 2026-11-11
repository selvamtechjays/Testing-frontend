import { apiFetch } from './client';
import type { Task, TaskStatus } from './types';

/** Fields a PATCH may carry; at least one is required by the server. */
export interface TaskPatch {
  title?: string;
  status?: TaskStatus;
}

/** GET /api/tasks (EP-TASK-01). The server returns the signed-in user's tasks, newest first. */
export function listTasks(signal?: AbortSignal): Promise<{ tasks: Task[] }> {
  return apiFetch<{ tasks: Task[] }>('/tasks', { signal });
}

/** POST /api/tasks (EP-TASK-02). Resolves with the stored task; rejects with ApiError otherwise. */
export function createTask(title: string, signal?: AbortSignal): Promise<{ task: Task }> {
  return apiFetch<{ task: Task }>('/tasks', { method: 'POST', body: { title }, signal });
}

/** PATCH /api/tasks/:id (EP-TASK-03). Used for tick, untick and title edits. */
export function updateTask(
  id: string,
  patch: TaskPatch,
  signal?: AbortSignal,
): Promise<{ task: Task }> {
  return apiFetch<{ task: Task }>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    signal,
  });
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
