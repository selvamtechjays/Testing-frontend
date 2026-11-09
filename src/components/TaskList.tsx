import { useState } from 'react';
import type { Task } from '../api/types';
import { copy } from '../copy';
import { exitDurationMs } from '../lib/motion';
import { TaskRow } from './TaskRow';
import { useExitingItems } from './useExitingItems';
import './TaskList.css';

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => Promise<boolean>;
  onEditTitle: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

/**
 * The rows exactly as given, in the order given (the server sends newest first). A removed row
 * stays briefly, hidden from assistive tech and inert, while it animates out (ui-standards §6).
 */
export function TaskList({ tasks, onToggle, onEditTitle, onDelete }: TaskListProps) {
  const [exitMs] = useState(exitDurationMs);
  const rows = useExitingItems(tasks, exitMs);
  return (
    <ul className="card task-list" aria-label={copy.tasksListLabel}>
      {rows.map(({ item, leaving }) => (
        <TaskRow
          key={item.id}
          task={item}
          leaving={leaving}
          onToggle={onToggle}
          onEditTitle={onEditTitle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
