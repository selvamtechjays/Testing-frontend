import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createTask, listTasks, updateTask, type TaskPatch } from '../api/tasks';
import type { Task } from '../api/types';
import { useInstantUpdate } from '../lib/useInstantUpdate';
import {
  editedSince,
  insertTemp,
  isTempId,
  mergeSearchResult,
  nextTempId,
  patchField,
  removeById,
  replaceId,
} from './taskState';
import { usePendingDelete } from './usePendingDelete';
import { TasksContext, type ListStatus, type TasksValue } from './tasksContext';

type LoadState = 'loading' | 'ready' | 'failed' | 'searchFailed';
type EditableField = 'title' | 'status';
type Stored = Pick<Task, EditableField>;

/** How long the box must sit still before its text becomes the query that is sent. */
const SEARCH_DEBOUNCE_MS = 300;

function toStatus(load: LoadState, count: number, appliedQuery: string): ListStatus {
  if (load === 'loading') return 'loading';
  if (load === 'failed') return 'loadFailed';
  if (load === 'searchFailed') return 'searchFailed';
  if (count > 0) return 'populated';
  return appliedQuery === '' ? 'empty' : 'noMatch';
}

/** The box's text, and the trimmed text 300 ms after the last keystroke, which is what is sent. */
function useSearchQuery() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);
  return { search, setSearch, query };
}

/** What the last finished request was for, so a request still in flight can be told apart. */
interface Settled {
  query: string;
  attempt: number;
}

/** The in-memory list, its load state, and what the server last confirmed per task. */
function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [load, setLoad] = useState<LoadState>('loading');
  const { search, setSearch, query } = useSearchQuery();
  const [attempt, setAttempt] = useState(0);
  const [appliedQuery, setAppliedQuery] = useState('');
  const [settled, setSettled] = useState<Settled | null>(null);
  const hasLoaded = useRef(false);
  // The list as of the latest change, readable synchronously (state is not, between renders).
  const listRef = useRef<Task[]>([]);
  // What the server last confirmed per task, so a failed change restores stored truth.
  const confirmed = useRef(new Map<string, Stored>());

  const commit = useCallback((change: (list: Task[]) => Task[]) => {
    listRef.current = change(listRef.current);
    setTasks(listRef.current);
  }, []);

  const remember = useCallback((task: Task) => {
    confirmed.current.set(task.id, { title: task.title, status: task.status });
  }, []);

  // Runs on mount and whenever the query changes (or Retry is pressed). Each run aborts the one
  // before it, and a response from an aborted run is dropped; an abort is not a failure.
  useEffect(() => {
    const controller = new AbortController();
    const sent = listRef.current;
    listTasks({ search: query, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        // What the user changed while this was in flight wins; the response's copy of it is stale.
        const now = listRef.current;
        result.tasks.filter((task) => !editedSince(sent, now, task.id)).forEach(remember);
        commit((list) => mergeSearchResult(result.tasks, sent, list));
        hasLoaded.current = true;
        setAppliedQuery(query);
        setLoad('ready');
        setSettled({ query, attempt });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // The first load keeps its own message; any later request failing is a failed search.
        setLoad(hasLoaded.current ? 'searchFailed' : 'failed');
        setSettled({ query, attempt });
      });
    return () => controller.abort();
  }, [query, attempt, commit, remember, listRef]);

  const retrySearch = useCallback(() => setAttempt((count) => count + 1), []);
  // Not busy before the first answer (that is the skeleton's job) or after a failed first load.
  const searching =
    settled !== null &&
    load !== 'failed' &&
    (settled.query !== query || settled.attempt !== attempt);

  return {
    tasks,
    load,
    search,
    setSearch,
    retrySearch,
    searching,
    appliedQuery,
    listRef,
    confirmed,
    commit,
    remember,
  };
}

type TaskStore = ReturnType<typeof useTaskStore>;

/** Add, tick and edit, each shown at once, saved in the background, undone if the save fails. */
function useTaskActions({ listRef, confirmed, commit, remember }: TaskStore) {
  const { run } = useInstantUpdate();

  const addTask = useCallback(
    (title: string) => {
      const temp: Task = {
        id: nextTempId(),
        title,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      return run({
        apply: () => commit((list) => insertTemp(list, temp)),
        save: async (signal) => {
          const { task } = await createTask(title, signal);
          remember(task);
          commit((list) => replaceId(list, temp.id, task));
        },
        rollback: () => commit((list) => removeById(list, temp.id)),
      });
    },
    [run, commit, remember],
  );

  /**
   * Shows one field's new value at once and saves only that field. On failure only that field
   * goes back, to what the server last confirmed - and only if no later change to the same
   * field has replaced this one, because that later change will settle the field itself.
   */
  const changeField = useCallback(
    <K extends EditableField>(id: string, field: K, value: Task[K]): Promise<boolean> => {
      const current = listRef.current.find((task) => task.id === id);
      if (!current || isTempId(id)) return Promise.resolve(false);
      if (current[field] === value) return Promise.resolve(true);
      const prior = current[field];
      const patch = { [field]: value } as TaskPatch;
      return run({
        apply: () => commit((list) => patchField(list, id, field, value)),
        save: async (signal) => {
          await updateTask(id, patch, signal);
          const stored = confirmed.current.get(id);
          if (stored) confirmed.current.set(id, { ...stored, [field]: value });
        },
        rollback: () =>
          commit((list) => {
            if (list.find((task) => task.id === id)?.[field] !== value) return list;
            const back = (confirmed.current.get(id)?.[field] ?? prior) as Task[K];
            return patchField(list, id, field, back);
          }),
      });
    },
    [run, commit, listRef, confirmed],
  );

  const toggleStatus = useCallback(
    (id: string) => {
      const current = listRef.current.find((task) => task.id === id);
      if (!current) return Promise.resolve(false);
      return changeField(id, 'status', current.status === 'completed' ? 'pending' : 'completed');
    },
    [changeField, listRef],
  );

  const editTitle = useCallback(
    (id: string, title: string) => changeField(id, 'title', title),
    [changeField],
  );

  return { addTask, toggleStatus, editTitle };
}

/**
 * Holds the signed-in user's task list in memory only: loaded on mount, never persisted,
 * and gone when the provider unmounts on sign-out or a change of user (AC-10).
 * Must sit inside FailureNoticeProvider because every change goes through useInstantUpdate.
 */
export function TasksProvider({ children }: { children: ReactNode }) {
  const store = useTaskStore();
  const { addTask, toggleStatus, editTitle } = useTaskActions(store);
  const { startDelete, undo: undoDelete, deletePending } = usePendingDelete(store);
  const { tasks, load, search, setSearch, retrySearch, searching, appliedQuery } = store;

  const value = useMemo<TasksValue>(
    () => ({
      tasks,
      status: toStatus(load, tasks.length, appliedQuery),
      search,
      setSearch,
      retrySearch,
      searching,
      searchApplied: appliedQuery !== '',
      addTask,
      toggleStatus,
      editTitle,
      startDelete,
      undoDelete,
      deletePending,
    }),
    [
      tasks,
      load,
      appliedQuery,
      search,
      setSearch,
      retrySearch,
      searching,
      addTask,
      toggleStatus,
      editTitle,
      startDelete,
      undoDelete,
      deletePending,
    ],
  );
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}
