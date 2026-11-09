import type { Task } from '../api/types';

/** Pure list reducers for the three mutation shapes. Newest first; none mutates its input. */

/** Marks the id of a row whose add has not been saved yet. */
export const TEMP_PREFIX = 'temp-';

const TEMP_ID_RANDOM_WORDS = 4;

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

/** Client-only id for a row whose add has not been saved yet. Random, so it needs no shared counter. */
export function nextTempId(): string {
  const words = crypto.getRandomValues(new Uint32Array(TEMP_ID_RANDOM_WORDS));
  return TEMP_PREFIX + Array.from(words, (word) => word.toString(16).padStart(8, '0')).join('');
}

export function insertTemp(list: Task[], task: Task): Task[] {
  return [task, ...list];
}

/** Swaps a temporary row for the stored task, keeping its position. */
export function replaceId(list: Task[], tempId: string, stored: Task): Task[] {
  return list.map((task) => (task.id === tempId ? stored : task));
}

export function removeById(list: Task[], id: string): Task[] {
  return list.filter((task) => task.id !== id);
}

/** Changes exactly one field of one row, leaving every other row and field as it is. */
export function patchField<K extends 'title' | 'status'>(
  list: Task[],
  id: string,
  field: K,
  value: Task[K],
): Task[] {
  return list.map((task) => (task.id === id ? { ...task, [field]: value } : task));
}

/** Puts a removed row back at its old index (clamped); a row already present is left alone. */
export function reinsertAt(list: Task[], task: Task, index: number): Task[] {
  if (list.some((existing) => existing.id === task.id)) return list;
  const at = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, at), task, ...list.slice(at)];
}

/**
 * Where a task belongs in a newest-first list, judged by createdAt alone: just before the first
 * row that is older. A task older than every row goes last.
 */
export function indexByCreatedAt(list: Task[], task: Task): number {
  const at = Date.parse(task.createdAt);
  const index = list.findIndex((row) => Date.parse(row.createdAt) < at);
  return index === -1 ? list.length : index;
}
