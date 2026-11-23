import type { Tag, Task, TaskTag } from '../api/types';
import { dueState } from '../lib/localDate';

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
  // A search response may already have brought the stored row in; then the temporary one just goes.
  if (list.some((task) => task.id === stored.id)) return removeById(list, tempId);
  return list.map((task) => (task.id === tempId ? stored : task));
}

export function removeById(list: Task[], id: string): Task[] {
  return list.filter((task) => task.id !== id);
}

/** Tag order everywhere: by name ignoring case (the server's collation: accents count, case does not). */
export function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'accent' }));
}

/**
 * The tags a task carries for these ids, sorted by name. Each is read from the user's tag list; an
 * id missing from it (the list is out of date or not loaded) keeps the task's own copy, and an id
 * known to neither is dropped.
 */
export function tagsForIds(all: Tag[], ids: string[], own: TaskTag[] = []): TaskTag[] {
  const found = ids.flatMap((id) => {
    const tag = all.find((candidate) => candidate.id === id) ?? own.find((t) => t.id === id);
    return tag ? [{ id: tag.id, name: tag.name, colour: tag.colour }] : [];
  });
  return sortByName(found);
}

/** True when both lists hold the same tags with the same names and colours, in the same order. */
export function sameTags(a: TaskTag[], b: TaskTag[]): boolean {
  return (
    a.length === b.length &&
    a.every((tag, i) => tag.id === b[i].id && tag.name === b[i].name && tag.colour === b[i].colour)
  );
}

/** Changes exactly one field of one row, leaving every other row and field as it is. */
export function patchField<
  K extends 'title' | 'status' | 'dueDate' | 'priority' | 'notes' | 'tags',
>(list: Task[], id: string, field: K, value: Task[K]): Task[] {
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

/** True when any editable field of a row differs from what it was when the request went out. */
function changedSince(sent: Task | undefined, now: Task): boolean {
  return (
    sent !== undefined &&
    (sent.title !== now.title ||
      sent.status !== now.status ||
      sent.dueDate !== now.dueDate ||
      sent.priority !== now.priority ||
      sent.notes !== now.notes ||
      !sameTags(sent.tags, now.tags))
  );
}

/**
 * What a search response becomes once the user has kept working while it was in flight.
 * `sent` is the list when the request went out, `now` the list as it is when the answer lands.
 * Rows added since stay on top in their current order; rows edited since, or still saving a
 * change, keep their current values over the response's; rows deleted since stay gone. Everything else is the response.
 */
export function mergeSearchResult(
  response: Task[],
  sent: Task[],
  now: Task[],
  /** A row with a change still saving keeps its current values: the response may predate the save. */
  isBusy: (id: string) => boolean = () => false,
): Task[] {
  const sentById = new Map(sent.map((task) => [task.id, task]));
  const nowById = new Map(now.map((task) => [task.id, task]));
  const added = now.filter((task) => !sentById.has(task.id));
  const addedIds = new Set(added.map((task) => task.id));
  const rest = response
    .filter((row) => !addedIds.has(row.id) && (nowById.has(row.id) || !sentById.has(row.id)))
    .map((row) => {
      const current = nowById.get(row.id);
      if (!current) return row;
      if (!isBusy(row.id) && !changedSince(sentById.get(row.id), current)) return row;
      return {
        ...row,
        title: current.title,
        status: current.status,
        dueDate: current.dueDate,
        priority: current.priority,
        notes: current.notes,
        tags: current.tags,
      };
    });
  return [...added, ...rest];
}

/** True when the row was edited after the request went out, so the response's copy is stale. */
export function editedSince(sent: Task[], now: Task[], id: string): boolean {
  const current = now.find((task) => task.id === id);
  return (
    current !== undefined &&
    changedSince(
      sent.find((task) => task.id === id),
      current,
    )
  );
}

/** What the overdue count needs to know about a row. */
type Dated = Pick<Task, 'status' | 'dueDate'>;

/**
 * How the overdue count moves when a row goes from `before` to `after` (null means the row did not
 * exist, or no longer does): +1 when it becomes overdue, -1 when it stops being overdue, else 0.
 */
export function overdueDelta(before: Dated | null, after: Dated | null, today: string): -1 | 0 | 1 {
  const was = before !== null && dueState(before, today) === 'overdue';
  const is = after !== null && dueState(after, today) === 'overdue';
  if (was === is) return 0;
  return is ? 1 : -1;
}
