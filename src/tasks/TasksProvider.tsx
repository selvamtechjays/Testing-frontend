import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createTask, listTasks, updateTask, type NewTask, type TaskPatch } from '../api/tasks';
import type { ListFilters, Task } from '../api/types';
import { localToday } from '../lib/localDate';
import { useInstantUpdate } from '../lib/useInstantUpdate';
import { DEFAULT_FILTERS, filtersNarrowing, loadFilters, saveFilters } from './listFilters';
import {
  editedSince,
  insertTemp,
  isTempId,
  mergeSearchResult,
  nextTempId,
  overdueDelta,
  patchField,
  removeById,
  replaceId,
} from './taskState';
import { usePendingDelete } from './usePendingDelete';
import { TasksContext, type ListStatus, type TasksValue } from './tasksContext';

type LoadState = 'loading' | 'ready' | 'failed' | 'searchFailed';
type EditableField = 'title' | 'status' | 'dueDate' | 'priority' | 'notes';
type Stored = Pick<Task, EditableField>;

/** How long the box must sit still before its text becomes the query that is sent. */
const SEARCH_DEBOUNCE_MS = 300;

function toStatus(
  load: LoadState,
  count: number,
  appliedQuery: string,
  filtersNarrowed: boolean,
): ListStatus {
  if (load === 'loading') return 'loading';
  if (load === 'failed') return 'loadFailed';
  if (load === 'searchFailed') return 'searchFailed';
  if (count > 0) return 'populated';
  return appliedQuery === '' && !filtersNarrowed ? 'empty' : 'noMatch';
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

/**
 * The status, priority, due and sort choices. They apply at once (no debounce: a select is one
 * decision, not a stream of keystrokes) and are remembered for this user on this device (DEC-217).
 */
function useListFilters(userId: string | undefined) {
  const [filters, setFilters] = useState<ListFilters>(() => loadFilters(userId));
  const latest = useRef(filters);
  const update = useCallback(
    (next: ListFilters) => {
      latest.current = next;
      setFilters(next);
      saveFilters(userId, next);
    },
    [userId],
  );
  const setFilter = useCallback(
    <K extends keyof ListFilters>(key: K, value: ListFilters[K]) =>
      update({ ...latest.current, [key]: value }),
    [update],
  );
  const clearFilters = useCallback(() => update(DEFAULT_FILTERS), [update]);
  return { filters, setFilter, clearFilters };
}

/** The server-confirmed copy of a task's editable fields, which a failed change restores. */
const toStored = (task: Task): Stored => ({
  title: task.title,
  status: task.status,
  dueDate: task.dueDate,
  priority: task.priority,
  notes: task.notes,
});

/** The user's calendar date as of the last request (DEC-218), readable synchronously by actions. */
function useToday(onNewDay: () => void) {
  const [today, setToday] = useState(() => localToday());
  const todayRef = useRef(today);
  /** Reads the date afresh; called once per list request. */
  const refreshToday = useCallback(() => {
    const now = localToday();
    todayRef.current = now;
    setToday(now);
    return now;
  }, []);
  // A tab left open past midnight learns the new day as soon as the person comes back to it, and
  // reloads the list so the overdue count follows the day.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const before = todayRef.current;
      if (refreshToday() !== before) onNewDay();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refreshToday, onNewDay]);
  return { today, todayRef, refreshToday };
}

/**
 * How many pending tasks are overdue: from each response, then moved by confirmed changes (DEC-219).
 * A response's absolute number is only taken when no change started, settled or is still saving
 * since its request went out, because the response may predate that change (DEC-235).
 */
function useOverdueCount() {
  const [overdueCount, setOverdueCount] = useState(0);
  const adjustOverdue = useCallback((delta: number) => {
    if (delta !== 0) setOverdueCount((count) => Math.max(0, count + delta));
  }, []);
  // Bumped when a saving change starts and again when it settles; `saving` is how many are open.
  const epoch = useRef(0);
  const saving = useRef(0);
  // Tasks with a change still saving: a response must not become their confirmed copy meanwhile,
  // or the save would later see its own change as already confirmed and move the count by 0.
  const busy = useRef(new Map<string, number>());
  const readEpoch = useCallback(() => epoch.current, []);
  /** Marks a change as saving (for this task, when given); call the returned function once settled. */
  const beginChange = useCallback((id?: string) => {
    saving.current += 1;
    epoch.current += 1;
    if (id !== undefined) busy.current.set(id, (busy.current.get(id) ?? 0) + 1);
    return () => {
      saving.current -= 1;
      epoch.current += 1;
      if (id === undefined) return;
      const left = (busy.current.get(id) ?? 1) - 1;
      if (left > 0) busy.current.set(id, left);
      else busy.current.delete(id);
    };
  }, []);
  /** Takes a response's count unless a change touched the count since `sentAt`. */
  const acceptServerCount = useCallback((sentAt: number, count: number) => {
    if (saving.current === 0 && epoch.current === sentAt) setOverdueCount(count);
  }, []);
  return { overdueCount, adjustOverdue, readEpoch, beginChange, busy, acceptServerCount };
}

/** True when a delete of `id` finished at or after the epoch a request was sent at. */
const deletedSince = (gone: Map<string, number>, id: string, sentAt: number) =>
  (gone.get(id) ?? -1) >= sentAt;

/** Forgets deletes that finished before `sentAt`: every later request already postdates them. */
function pruneGone(gone: Map<string, number>, sentAt: number) {
  gone.forEach((epoch, id) => {
    if (epoch < sentAt) gone.delete(id);
  });
}

/** What the list request needs and where its answer goes. */
interface LoaderInput {
  query: string;
  filters: ListFilters;
  attempt: number;
  listRef: RefObject<Task[]>;
  commit: (change: (list: Task[]) => Task[]) => void;
  remember: (task: Task) => void;
  refreshToday: () => string;
  deleting: RefObject<Set<string>>;
  gone: RefObject<Map<string, number>>;
  busy: RefObject<Map<string, number>>;
  readEpoch: () => number;
  acceptServerCount: (sentAt: number, count: number) => void;
}

/** What the last finished request was for, and how it ended. */
function useListLoader(input: LoaderInput) {
  const { query, filters, attempt, listRef, commit, remember, refreshToday } = input;
  const { deleting, gone, busy, readEpoch, acceptServerCount } = input;
  const [load, setLoad] = useState<LoadState>('loading');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<ListFilters>(filters);
  // The key of the last finished request; a different key for the current inputs means one is in flight.
  const [settled, setSettled] = useState<string | null>(null);
  const requestKey = JSON.stringify([query, filters, attempt]);
  const hasLoaded = useRef(false);

  // Runs on mount and whenever the search text or a filter changes (or Retry is pressed). Each run
  // aborts the one before it, and a response from an aborted run is dropped; an abort is not a failure.
  useEffect(() => {
    const controller = new AbortController();
    const sent = listRef.current;
    const sentAt = readEpoch();
    // "Today" is the user's own calendar date, read fresh for every request (DEC-218).
    listTasks({ search: query, filters, today: refreshToday(), signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        // What the user changed while this was in flight wins; the response's copy of it is stale.
        const now = listRef.current;
        result.tasks
          .filter((task) => !editedSince(sent, now, task.id) && !busy.current.has(task.id))
          .forEach(remember);
        // A task whose delete is held, saving, or finished since this request went out is gone,
        // whatever the server still lists: the response may predate the delete reaching it.
        commit((list) =>
          mergeSearchResult(result.tasks, sent, list).filter(
            (task) =>
              !deleting.current.has(task.id) && !deletedSince(gone.current, task.id, sentAt),
          ),
        );
        pruneGone(gone.current, sentAt);
        hasLoaded.current = true;
        setAppliedQuery(query);
        setAppliedFilters(filters);
        acceptServerCount(sentAt, result.overdueCount ?? 0);
        setLoad('ready');
        setSettled(requestKey);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // The first load keeps its own message; any later request failing is a failed search.
        setLoad(hasLoaded.current ? 'searchFailed' : 'failed');
        setSettled(requestKey);
      });
    return () => controller.abort();
  }, [
    query,
    filters,
    attempt,
    requestKey,
    commit,
    remember,
    listRef,
    refreshToday,
    deleting,
    gone,
    busy,
    readEpoch,
    acceptServerCount,
  ]);

  // Not busy before the first answer (that is the skeleton's job) or after a failed first load.
  const searching = settled !== null && load !== 'failed' && settled !== requestKey;
  return { load, appliedQuery, appliedFilters, searching };
}

/** The in-memory list, its load state, and what the server last confirmed per task. */
function useTaskStore(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const { search, setSearch, query } = useSearchQuery();
  const { filters, setFilter, clearFilters } = useListFilters(userId);
  const [attempt, setAttempt] = useState(0);
  const retrySearch = useCallback(() => setAttempt((count) => count + 1), []);
  const { today, todayRef, refreshToday } = useToday(retrySearch);
  const { overdueCount, adjustOverdue, readEpoch, beginChange, busy, acceptServerCount } =
    useOverdueCount();
  // Ids whose delete is held for Undo or saving: no list reload may bring them back.
  const deleting = useRef(new Set<string>());
  // Ids whose delete the server has taken, with the epoch it finished at: a list response whose
  // request went out before then may still list them.
  const gone = useRef(new Map<string, number>());
  // The list as of the latest change, readable synchronously (state is not, between renders).
  const listRef = useRef<Task[]>([]);
  // What the server last confirmed per task, so a failed change restores stored truth.
  const confirmed = useRef(new Map<string, Stored>());

  const commit = useCallback((change: (list: Task[]) => Task[]) => {
    listRef.current = change(listRef.current);
    setTasks(listRef.current);
  }, []);

  const remember = useCallback((task: Task) => {
    confirmed.current.set(task.id, toStored(task));
  }, []);

  const { load, appliedQuery, appliedFilters, searching } = useListLoader({
    query,
    filters,
    attempt,
    listRef,
    commit,
    remember,
    refreshToday,
    deleting,
    gone,
    busy,
    readEpoch,
    acceptServerCount,
  });

  return {
    tasks,
    load,
    search,
    setSearch,
    retrySearch,
    searching,
    appliedQuery,
    filters,
    setFilter,
    clearFilters,
    filtersApplied: filtersNarrowing(appliedFilters),
    today,
    todayRef,
    overdueCount,
    adjustOverdue,
    beginChange,
    deleting,
    gone,
    readEpoch,
    listRef,
    confirmed,
    commit,
    remember,
  };
}

type TaskStore = ReturnType<typeof useTaskStore>;

/** Add: shown at once at the top, saved in the background, removed again if the save fails. */
function useAddTask({ commit, remember, todayRef, adjustOverdue, beginChange }: TaskStore) {
  const { run } = useInstantUpdate();
  return useCallback(
    (input: NewTask) => {
      const temp: Task = {
        id: nextTempId(),
        title: input.title,
        status: 'pending',
        createdAt: new Date().toISOString(),
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? 'medium',
        notes: null,
      };
      const settled = beginChange();
      return run({
        apply: () => commit((list) => insertTemp(list, temp)),
        save: async (signal) => {
          const { task } = await createTask(input, signal);
          remember(task);
          commit((list) => replaceId(list, temp.id, task));
          adjustOverdue(overdueDelta(null, task, todayRef.current));
        },
        rollback: () => commit((list) => removeById(list, temp.id)),
      }).finally(settled);
    },
    [run, commit, remember, adjustOverdue, todayRef, beginChange],
  );
}

/** Tick and edits, each shown at once, saved in the background, undone if the save fails. */
function useFieldChanges(store: TaskStore) {
  const { listRef, confirmed, commit, todayRef, adjustOverdue, beginChange } = store;
  const { run } = useInstantUpdate();

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
      const settled = beginChange(id);
      return run({
        apply: () => commit((list) => patchField(list, id, field, value)),
        save: async (signal) => {
          await updateTask(id, patch, signal);
          const stored = confirmed.current.get(id);
          if (!stored) return;
          const after = { ...stored, [field]: value };
          confirmed.current.set(id, after);
          adjustOverdue(overdueDelta(stored, after, todayRef.current));
        },
        rollback: () =>
          commit((list) => {
            if (list.find((task) => task.id === id)?.[field] !== value) return list;
            const stored = confirmed.current.get(id);
            const back = (stored ? stored[field] : prior) as Task[K];
            return patchField(list, id, field, back);
          }),
      }).finally(settled);
    },
    [run, commit, listRef, confirmed, adjustOverdue, todayRef, beginChange],
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

  const changeDueDate = useCallback(
    (id: string, dueDate: string | null) => changeField(id, 'dueDate', dueDate),
    [changeField],
  );

  const changePriority = useCallback(
    (id: string, priority: Task['priority']) => changeField(id, 'priority', priority),
    [changeField],
  );

  const changeNotes = useCallback(
    (id: string, notes: string | null) => changeField(id, 'notes', notes),
    [changeField],
  );

  return { toggleStatus, editTitle, changeDueDate, changePriority, changeNotes };
}

/**
 * Delete with Undo. A delete counts toward the overdue count once the server has taken it: the
 * request was sent and did not fail. Undo is the one way a successful delete changes nothing, so
 * it is noted by id. Until the delete settles its id is kept out of every list reload.
 */
function useCountedDelete(store: TaskStore) {
  const { listRef, adjustOverdue, beginChange, deleting, gone, readEpoch } = store;
  const { confirmed, todayRef } = store;
  const { startDelete: holdDelete, undo, deletePending } = usePendingDelete(store);
  const undone = useRef(new Set<string>());
  const startDelete = useCallback(
    async (id: string) => {
      const row = listRef.current.find((task) => task.id === id);
      deleting.current.add(id);
      const settled = beginChange(id);
      const ok = await holdDelete(id);
      settled();
      const wasUndone = undone.current.delete(id);
      deleting.current.delete(id);
      if (ok && !wasUndone) gone.current.set(id, readEpoch());
      if (ok && !wasUndone && row) {
        adjustOverdue(overdueDelta(confirmed.current.get(id) ?? row, null, todayRef.current));
        confirmed.current.delete(id);
      }
      return ok;
    },
    [
      holdDelete,
      listRef,
      adjustOverdue,
      beginChange,
      deleting,
      gone,
      readEpoch,
      confirmed,
      todayRef,
    ],
  );
  const undoDelete = useCallback(() => {
    const id = undo();
    if (id === null) return;
    undone.current.add(id);
    deleting.current.delete(id);
  }, [undo, deleting]);
  return { startDelete, undoDelete, deletePending };
}

type Actions = ReturnType<typeof useFieldChanges> &
  ReturnType<typeof useCountedDelete> & { addTask: ReturnType<typeof useAddTask> };

/** The context value: the store's state and every action, rebuilt only when one of them changes. */
function useTasksValue(store: TaskStore, actions: Actions): TasksValue {
  const { tasks, load, search, setSearch, retrySearch, searching, appliedQuery } = store;
  const { filters, setFilter, clearFilters, filtersApplied, today, overdueCount } = store;
  const { addTask, toggleStatus, editTitle, changeDueDate, changePriority, changeNotes } = actions;
  const { startDelete, undoDelete, deletePending } = actions;
  return useMemo<TasksValue>(
    () => ({
      tasks,
      status: toStatus(load, tasks.length, appliedQuery, filtersApplied),
      search,
      setSearch,
      retrySearch,
      searching,
      searchApplied: appliedQuery !== '',
      filters,
      setFilter,
      clearFilters,
      filtersApplied,
      today,
      overdueCount,
      addTask,
      toggleStatus,
      editTitle,
      changeDueDate,
      changePriority,
      changeNotes,
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
      filters,
      setFilter,
      clearFilters,
      filtersApplied,
      today,
      overdueCount,
      addTask,
      toggleStatus,
      editTitle,
      changeDueDate,
      changePriority,
      changeNotes,
      startDelete,
      undoDelete,
      deletePending,
    ],
  );
}

/**
 * Holds the signed-in user's task list in memory only: loaded on mount, never persisted,
 * and gone when the provider unmounts on sign-out or a change of user (AC-10).
 * Must sit inside FailureNoticeProvider because every change goes through useInstantUpdate.
 * Only the filter choices are remembered, on this device, under the given user's id (DEC-217).
 */
export function TasksProvider({
  children,
  userId,
}: {
  children: ReactNode;
  /** Keys the remembered filters; without it they are not remembered. */
  userId?: string;
}) {
  const store = useTaskStore(userId);
  const addTask = useAddTask(store);
  const changes = useFieldChanges(store);
  const deletion = useCountedDelete(store);
  const value = useTasksValue(store, { addTask, ...changes, ...deletion });
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}
