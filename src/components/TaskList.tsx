import { useState } from 'react';
import type { Task, TaskPriority } from '../api/types';
import { copy } from '../copy';
import { exitDurationMs } from '../lib/motion';
import { TaskRow } from './TaskRow';
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
  onDelete: (id: string) => Promise<boolean>;
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
  onDelete,
}: TaskListProps) {
  const [exitMs] = useState(exitDurationMs);
  const rows = useExitingItems(tasks, exitMs);
  return (
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
        />
      ))}
    </ul>
  );
}
