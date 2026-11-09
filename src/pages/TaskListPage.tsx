import { AddTaskForm } from '../components/AddTaskForm';
import { FailureNotice } from '../components/FailureNotice';
import { StatusMessage } from '../components/StatusMessage';
import { TaskList } from '../components/TaskList';
import { TaskListEmpty, TaskListLoading } from '../components/TaskListStates';
import { UndoMessage } from '../components/UndoMessage';
import { useAuth } from '../auth/AuthContext';
import { copy } from '../copy';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { TasksProvider } from '../tasks/TasksProvider';
import { useTasks } from '../tasks/useTasks';

function Body() {
  const { tasks, status, toggleStatus, editTitle, startDelete } = useTasks();
  if (status === 'loading') return <TaskListLoading />;
  if (status === 'loadFailed')
    return <StatusMessage kind="alert">{copy.tasksLoadFailed}</StatusMessage>;
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

function Content() {
  const { status, addTask, deletePending, undoDelete } = useTasks();
  const { message, dismiss } = useFailureNotice();
  // Only a list that loaded can take an add: while loading it would race the load, and after a
  // failed load an added task would never appear.
  const canAdd = status === 'empty' || status === 'populated';
  return (
    <>
      <div className="page-header">
        <h1>{copy.homeHeading}</h1>
        <p className="page-intro">{copy.homeIntro}</p>
      </div>
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
