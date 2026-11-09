import type { Task } from '../api/types';
import { copy } from '../copy';
import { TaskRow } from './TaskRow';
import './TaskList.css';

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => Promise<boolean>;
  onEditTitle: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

/** The rows exactly as given, in the order given (the server sends newest first). */
export function TaskList({ tasks, onToggle, onEditTitle, onDelete }: TaskListProps) {
  return (
    <ul className="task-list" aria-label={copy.tasksListLabel}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={onToggle}
          onEditTitle={onEditTitle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
