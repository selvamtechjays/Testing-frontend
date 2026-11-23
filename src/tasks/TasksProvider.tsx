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
import type { ListFilters, Task, TaskTag } from '../api/types';
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
  sortByName,
} from './taskState';
import { useTagActions } from './useTagActions';
import { useTagManagement } from './useTagManagement';
import { useTagFilter, type TagFilterState } from './useTagFilter';
import { useTagList } from './useTagList';
import { usePendingDelete } from './usePendingDelete';
import { TasksContext, type ListStatus, type TasksValue } from './tasksContext';

type LoadState = 'loading' | 'ready' | 'failed' | 'searchFailed';
type EditableField = 'title' | 'status' | 'dueDate' | 'priority' | 'notes' | 'tags';
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
 * The status, priority, due, sort and tag choices. They apply at once (no debounce: a select is one
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
  return { filters, setFilter, clearFilters, latest };
}

type ListFiltersState = ReturnType<typeof useListFilters>;

/** The server-confirmed copy of a task's editable fields, which a failed change restores. */
const toStored = (task: Task): Stored => ({
  title: task.title,
  status: task.status,
  dueDate: task.dueDate,
  priority: task.priority,
  notes: task.notes,
  tags: task.tags,
});

/** The request body for one changed field: the tag list goes as ids, everything else as itself. */
function toPatch<K extends EditableField>(field: K, value: Task[K]): TaskPatch {
  if (field === 'tags') return { tagIds: (value as TaskTag[]).map((tag) => tag.id) };
  return { [field]: value } as TaskPatch;
}

/** Sends one patch; a refusal is shown to `onRefused` first so the caller can react to its kind. */
async function sendPatch(
  id: string,
  patch: TaskPatch,
  signal: AbortSignal,
  onRefused?: (error: unknown) => void,
) {
  try {
    await updateTask(id, patch, signal);
  } catch (error) {
    onRefused?.(error);
    throw error;
  }
}

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
  /** The Tag filter's say over the request: hold it back, and react to a refusal naming `tag`. */
  tagGate: Pick<TagFilterState, 'hold' | 'onRefused'>;
}

/**
 * Takes a list response into the in-memory list. What the user changed while the request was in
 * flight wins; a task whose delete is held, saving, or finished since it went out is gone, whatever
 * the server still lists, because the response may predate the delete reaching it.
 */
function takeResponse(
  input: Pick<LoaderInput, 'listRef' | 'commit' | 'remember' | 'deleting' | 'gone' | 'busy'>,
  tasks: Task[],
  sent: Task[],
  sentAt: number,
) {
  const { listRef, commit, remember, deleting, gone, busy } = input;
  const now = listRef.current;
  tasks
    .filter((task) => !editedSince(sent, now, task.id) && !busy.current.has(task.id))
    .forEach(remember);
  commit((list) =>
    mergeSearchResult(tasks, sent, list, (id) => busy.current.has(id)).filter(
      (task) => !deleting.current.has(task.id) && !deletedSince(gone.current, task.id, sentAt),
    ),
  );
  pruneGone(gone.current, sentAt);
}

/** What the last finished request was for, and how it ended. */
function useListLoader(input: LoaderInput) {
  const { query, filters, attempt, listRef, commit, remember, refreshToday } = input;
  const { deleting, gone, busy, readEpoch, acceptServerCount } = input;
  const { hold, onRefused } = input.tagGate;
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
    // A remembered tag id waits until the tag list says whether it still exists.
    if (hold) return;
    const controller = new AbortController();
    const sent = listRef.current;
    const sentAt = readEpoch();
    // "Today" is the user's own calendar date, read fresh for every request (DEC-218).
    listTasks({ search: query, filters, today: refreshToday(), signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        takeResponse(
          { listRef, commit, remember, deleting, gone, busy },
          result.tasks,
          sent,
          sentAt,
        );
        hasLoaded.current = true;
        setAppliedQuery(query);
        setAppliedFilters(filters);
        acceptServerCount(sentAt, result.overdueCount ?? 0);
        setLoad('ready');
        setSettled(requestKey);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        onRefused(error);
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
    hold,
    onRefused,
  ]);

  // Not busy before the first answer (that is the skeleton's job) or after a failed first load.
  const searching = settled !== null && load !== 'failed' && settled !== requestKey;
  return { load, appliedQuery, appliedFilters, searching };
}

/** The in-memory list, its load state, and what the server last confirmed per task. */
function useTaskStore(listFilters: ListFiltersState, tagGate: LoaderInput['tagGate']) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const { search, setSearch, query } = useSearchQuery();
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
    filters: listFilters.filters,
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
    tagGate,
  });

  return {
    tasks,
    load,
    search,
    setSearch,
    retrySearch,
    searching,
    appliedQuery,
    ...listFilters,
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
        tags: [],
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

/** What a saved change confirms: for tags, the ids sent with the names the row shows now. */
function settledValue<K extends EditableField>(
  field: K,
  value: Task[K],
  list: Task[],
  id: string,
): Task[K] {
  if (field !== 'tags') return value;
  const shown = list.find((task) => task.id === id)?.tags ?? [];
  return sortByName(
    (value as TaskTag[]).map((tag) => shown.find((own) => own.id === tag.id) ?? tag),
  ) as Task[K];
}

/**
 * One save at a time per task: `ready` resolves when every earlier save for that task has
 * settled, and `done` lets the next one go.
 */
function useSaveQueue() {
  const queue = useRef(new Map<string, Promise<void>>());
  return useCallback((id: string) => {
    const ready = queue.current.get(id) ?? Promise.resolve();
    let release = () => {};
    const finished = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = ready.then(() => finished);
    queue.current.set(id, tail);
    return {
      ready,
      /** True while no later save for this task has been queued behind this one. */
      isLatest: () => queue.current.get(id) === tail,
      done: () => {
        release();
        if (queue.current.get(id) === tail) queue.current.delete(id);
      },
    };
  }, []);
}

/**
 * A failed save puts one field back to what the server last confirmed (or what it was before),
 * unless a later change to the same field has replaced this one: that change settles it.
 * `latest` says so for tags (the save queue knows); a rename or a dropped tag may reshape the
 * row's tags meanwhile, so their value says nothing about whether a later tick exists.
 */
function restoreField<K extends EditableField>(
  list: Task[],
  change: {
    id: string;
    field: K;
    value: Task[K];
    stored: Stored | undefined;
    prior: Task[K];
    latest?: boolean;
  },
): Task[] {
  const { id, field, value, stored, prior, latest } = change;
  const shown = list.find((task) => task.id === id);
  if (!shown) return list;
  const replaced = latest === undefined ? shown[field] !== value : !latest;
  if (replaced) return list;
  return patchField(list, id, field, (stored ? stored[field] : prior) as Task[K]);
}

/**
 * The one optimistic field change every edit goes through. Shows one field's new value at once and
 * saves only that field; see `changeField` below.
 */
function useChangeField(store: TaskStore) {
  const { listRef, confirmed, commit, todayRef, adjustOverdue, beginChange } = store;
  const { run } = useInstantUpdate();
  const takeTurn = useSaveQueue();

  /**
   * Shows one field's new value at once and saves only that field. On failure only that field
   * goes back, to what the server last confirmed - and only if no later change to the same
   * field has replaced this one, because that later change will settle the field itself.
   */
  return useCallback(
    <K extends EditableField>(
      id: string,
      field: K,
      value: Task[K],
      onRefused?: (error: unknown) => void,
    ): Promise<boolean> => {
      const current = listRef.current.find((task) => task.id === id);
      if (!current || isTempId(id)) return Promise.resolve(false);
      if (current[field] === value) return Promise.resolve(true);
      const prior = current[field];
      const patch = toPatch(field, value);
      const settled = beginChange(id);
      // A tag change sends the whole list, so two on one task must reach the server in order.
      const turn = field === 'tags' ? takeTurn(id) : undefined;
      return run({
        apply: () => commit((list) => patchField(list, id, field, value)),
        clockStartsOnSend: turn !== undefined,
        save: async (signal, startClock) => {
          if (turn) {
            await turn.ready;
            startClock();
          }
          await sendPatch(id, patch, signal, onRefused);
          const stored = confirmed.current.get(id);
          if (!stored) return;
          const after = { ...stored, [field]: settledValue(field, value, listRef.current, id) };
          confirmed.current.set(id, after);
          adjustOverdue(overdueDelta(stored, after, todayRef.current));
        },
        rollback: () =>
          commit((list) =>
            restoreField(list, {
              id,
              field,
              value,
              stored: confirmed.current.get(id),
              prior,
              latest: turn?.isLatest(),
            }),
          ),
      }).finally(() => {
        turn?.done();
        settled();
      });
    },
    [run, commit, listRef, confirmed, adjustOverdue, todayRef, beginChange, takeTurn],
  );
}

/** Tick and edits, each shown at once, saved in the background, undone if the save fails. */
function useFieldChanges(store: TaskStore) {
  const { listRef } = store;
  const changeField = useChangeField(store);

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

  return { changeField, toggleStatus, editTitle, changeDueDate, changePriority, changeNotes };
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
  ReturnType<typeof useCountedDelete> &
  ReturnType<typeof useTagActions> & { addTask: ReturnType<typeof useAddTask> } & {
    tagList: ReturnType<typeof useTagList>;
    tagFilter: TagFilterState;
    tagManagement: ReturnType<typeof useTagManagement>;
  };

/** The tag part of the context value, rebuilt only when the tag list or a tag action changes. */
function useTagsValue({
  tagList,
  tagFilter,
  tagManagement,
  changeTags,
  createTagAndTick,
}: Actions) {
  const { tags, tagsStatus, refreshTags } = tagList;
  const { selectTag, tagDeleted } = tagFilter;
  const { updateTag, deleteTag, freshTaskCount } = tagManagement;
  return useMemo(
    () => ({
      tags,
      tagsStatus,
      refreshTags,
      changeTags,
      createTagAndTick,
      selectTag,
      tagDeleted,
      updateTag,
      deleteTag,
      freshTaskCount,
    }),
    [
      tags,
      tagsStatus,
      refreshTags,
      changeTags,
      createTagAndTick,
      selectTag,
      tagDeleted,
      updateTag,
      deleteTag,
      freshTaskCount,
    ],
  );
}

/** The context value: the store's state and every action, rebuilt only when one of them changes. */
function useTasksValue(store: TaskStore, actions: Actions): TasksValue {
  const { tasks, load, search, setSearch, retrySearch, searching, appliedQuery } = store;
  const { filters, setFilter, clearFilters, filtersApplied, today, overdueCount } = store;
  const { addTask, toggleStatus, editTitle, changeDueDate, changePriority, changeNotes } = actions;
  const { startDelete, undoDelete, deletePending } = actions;
  const tagsValue = useTagsValue(actions);
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
      ...tagsValue,
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
      tagsValue,
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
  const tagList = useTagList();
  const listFilters = useListFilters(userId);
  const tagFilter = useTagFilter({ ...listFilters, tagList });
  const store = useTaskStore(listFilters, tagFilter);
  const addTask = useAddTask(store);
  const changes = useFieldChanges(store);
  const deletion = useCountedDelete(store);
  const tagActions = useTagActions({
    listRef: store.listRef,
    commit: store.commit,
    confirmed: store.confirmed,
    changeField: changes.changeField,
    tagList,
  });
  const tagManagement = useTagManagement({
    commit: store.commit,
    confirmed: store.confirmed,
    tagList,
    tagDeleted: tagFilter.tagDeleted,
  });
  const value = useTasksValue(store, {
    addTask,
    ...changes,
    ...deletion,
    ...tagActions,
    tagList,
    tagFilter,
    tagManagement,
  });
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}
