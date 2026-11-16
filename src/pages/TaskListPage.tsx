import { AddTaskForm } from '../components/AddTaskForm';
import { FailureNotice } from '../components/FailureNotice';
import { StatusMessage } from '../components/StatusMessage';
import { TaskList } from '../components/TaskList';
import { SearchLiveRegion, TaskSearch } from '../components/TaskSearch';
import {
  TaskListEmpty,
  TaskListLoading,
  TaskListNoMatch,
  TaskListSearchFailed,
} from '../components/TaskListStates';
import { UndoMessage } from '../components/UndoMessage';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { TasksProvider } from '../tasks/TasksProvider';
import type { ListStatus } from '../tasks/tasksContext';
import { useTasks } from '../tasks/useTasks';

function Body() {
  const { tasks, status, toggleStatus, editTitle, startDelete, retrySearch } = useTasks();
  if (status === 'loading') return <TaskListLoading />;
  if (status === 'loadFailed')
    return <StatusMessage kind="alert">{copy.tasksLoadFailed}</StatusMessage>;
  if (status === 'searchFailed') return <TaskListSearchFailed onRetry={retrySearch} />;
  if (status === 'noMatch') return <TaskListNoMatch />;
  if (status === 'empty') return <TaskListEmpty />;
  return (
    <TaskList
      tasks={tasks}
      onToggle={toggleStatus}
      onEditTitle={editTitle}
      onDelete={startDelete}
    />
  );
}

/** What a screen reader hears once a search settles: the match count, or that nothing matched. */
function announcement(
  status: ListStatus,
  searchApplied: boolean,
  searching: boolean,
  count: number,
): string {
  if (status === 'noMatch' && !searching) return copy.searchNoMatch;
  if (status === 'populated' && searchApplied && !searching) return copy.searchResultCount(count);
  return '';
}

function Content() {
  const {
    tasks,
    status,
    addTask,
    deletePending,
    undoDelete,
    search,
    setSearch,
    searching,
    searchApplied,
  } = useTasks();
  const { message, dismiss } = useFailureNotice();
  // Only a list that loaded can take an add: while loading it would race the load, and after a
  // failed load or failed search an added task would never appear.
  const canAdd = status === 'empty' || status === 'populated' || status === 'noMatch';
  // Search needs a list to search: not during the first load, nor after it failed.
  const canSearch = status !== 'loading' && status !== 'loadFailed';
  return (
    <>
      <div className="page-header">
        <h1>{copy.homeHeading}</h1>
        <p className="page-intro">{copy.homeIntro}</p>
      </div>
      {canAdd ? <AddTaskForm onAdd={(title) => void addTask(title)} /> : null}
      {canSearch ? <TaskSearch value={search} onChange={setSearch} /> : null}
      <SearchLiveRegion message={announcement(status, searchApplied, searching, tasks.length)} />
      <FailureNotice message={message} onDismiss={dismiss} />
      <UndoMessage visible={deletePending} onUndo={undoDelete} />
      <div aria-busy={searching}>
        <Body />
      </div>
    </>
  );
}

/**
 * The signed-in home (PAGE-TASK-01). Keyed by user so a different person never sees the previous
 * person's list: the providers remount and the in-memory list starts empty (AC-10).
 */
export function TaskListPage() {
  const { user } = useAuth();
  return (
    <FailureNoticeProvider key={user?.id ?? 'none'}>
      <TasksProvider>
        <Content />
      </TasksProvider>
    </FailureNoticeProvider>
  );
}
