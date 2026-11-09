import { AddTaskForm } from '../components/AddTaskForm';
import { FailureNotice } from '../components/FailureNotice';
import { StatusMessage } from '../components/StatusMessage';
import { TaskList } from '../components/TaskList';
import { UndoMessage } from '../components/UndoMessage';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { TasksProvider } from '../tasks/TasksProvider';
import { useTasks } from '../tasks/useTasks';

function Body() {
  const { tasks, status, toggleStatus, editTitle, startDelete } = useTasks();
  if (status === 'loading') return <p>{copy.tasksLoading}</p>;
  if (status === 'loadFailed')
    return <StatusMessage kind="alert">{copy.tasksLoadFailed}</StatusMessage>;
  if (status === 'empty') return <p>{copy.tasksEmpty}</p>;
  return (
    <TaskList
      tasks={tasks}
      onToggle={toggleStatus}
      onEditTitle={editTitle}
      onDelete={startDelete}
    />
  );
}

function Content() {
  const { status, addTask, deletePending, undoDelete } = useTasks();
  const { message, dismiss } = useFailureNotice();
  // Only a list that loaded can take an add: while loading it would race the load, and after a
  // failed load an added task would never appear.
  const canAdd = status === 'empty' || status === 'populated';
  return (
    <>
      <h1>{copy.homeHeading}</h1>
      <p>{copy.homeIntro}</p>
      {canAdd ? <AddTaskForm onAdd={(title) => void addTask(title)} /> : null}
      <FailureNotice message={message} onDismiss={dismiss} />
      <UndoMessage visible={deletePending} onUndo={undoDelete} />
      <Body />
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
