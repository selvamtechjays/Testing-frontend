import { useCallback, useState } from 'react';
import type { Task, TaskPriority } from '../api/types';
import { copy } from '../copy';
import { exitDurationMs } from '../lib/motion';
import { TaskRow, type RowNotes } from './TaskRow';
import { useExitingItems } from './useExitingItems';
import './TaskList.css';

interface TaskListProps {
  tasks: Task[];
  /** The user's calendar date, for each row's Overdue and Due today words. */
  today: string;
  onToggle: (id: string) => Promise<boolean>;
  onEditTitle: (id: string, title: string) => Promise<boolean>;
  onChangeDueDate: (id: string, dueDate: string | null) => Promise<boolean>;
  onChangePriority: (id: string, priority: TaskPriority) => Promise<boolean>;
  onChangeNotes: (id: string, notes: string | null) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

/**
 * Which row's notes panel is open (one at a time), whether it holds an unsaved change, and the one
 * not-saved line. Every way a panel closes with a typed change lost sets the line (DEC-238);
 * opening a panel clears it, unless it replaced a panel holding a typed change.
 */
function useOpenNotes(openGone: (openId: string | null) => boolean) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notSaved, setNotSaved] = useState(false);

  const close = useCallback((lost: boolean) => {
    setOpenId(null);
    setDirty(false);
    setNotSaved(lost);
  }, []);
  const toggle = (id: string) => {
    if (openId === id) {
      close(dirty);
      return;
    }
    // Switching away from a panel with a typed change loses it, and says so (DEC-238).
    const lost = openId !== null && dirty;
    setOpenId(id);
    setDirty(false);
    setNotSaved(lost);
  };
  // The open row left the list (deleted, or filtered out): its panel goes with it.
  if (openId !== null && openGone(openId)) close(dirty);
  return { openId, toggle, close, setDirty, notSaved };
}

/**
 * The rows exactly as given, in the order given (the server sends them in the chosen sort). A removed
 * row stays briefly, hidden from assistive tech and inert, while it animates out (ui-standards §6).
 */
export function TaskList({
  tasks,
  today,
  onToggle,
  onEditTitle,
  onChangeDueDate,
  onChangePriority,
  onChangeNotes,
  onDelete,
}: TaskListProps) {
  const [exitMs] = useState(exitDurationMs);
  const rows = useExitingItems(tasks, exitMs);
  const { openId, toggle, close, setDirty, notSaved } = useOpenNotes(
    (id) => !rows.some((row) => row.item.id === id && !row.leaving),
  );
  const notesFor = (id: string): RowNotes => ({
    open: openId === id,
    onToggle: () => toggle(id),
    onChange: onChangeNotes,
    onClose: close,
    onDirtyChange: setDirty,
  });
  return (
    <>
      <p
        aria-live="polite"
        aria-atomic="true"
        className={notSaved ? 'message message-status' : 'task-list-live'}
      >
        {notSaved ? copy.notesNotSaved : ''}
      </p>
      <ul className="card task-list" aria-label={copy.tasksListLabel}>
        {rows.map(({ item, leaving }) => (
          <TaskRow
            key={item.id}
            task={item}
            today={today}
            leaving={leaving}
            onToggle={onToggle}
            onEditTitle={onEditTitle}
            onChangeDueDate={onChangeDueDate}
            onChangePriority={onChangePriority}
            onDelete={onDelete}
            notes={notesFor(item.id)}
          />
        ))}
      </ul>
    </>
  );
}
