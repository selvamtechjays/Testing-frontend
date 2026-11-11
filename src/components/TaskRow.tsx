import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react';
import type { Task } from '../api/types';
import { copy } from '../copy';
import { isTempId } from '../tasks/taskState';
import { clampTitle, validateTitle } from '../validation/title';
import { Button } from './Button';
import './TaskRow.css';

interface TaskRowProps {
  task: Task;
  onToggle: (id: string) => Promise<boolean>;
  onEditTitle: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  /** The row was removed and is animating out: hidden from assistive tech, every control off. */
  leaving?: boolean;
}

interface EditTitleFormProps {
  id: string;
  initial: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}

/** Title edit: pre-filled, selected on entry; empty is refused, input stops at 200 (AC-5, AC-6). */
function EditTitleForm({ id, initial, onSave, onCancel }: EditTitleFormProps) {
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const messageId = `task-${id}-message`;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const change = (raw: string) => {
    const { value, truncated } = clampTitle(raw);
    setDraft(value);
    setMessage(truncated ? copy.titleTooLong : undefined);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const check = validateTitle(draft);
    if (check.ok) onSave(check.title);
    else setMessage(copy.titleMissing);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') onCancel();
  };

  return (
    <form className="task-row-form" onSubmit={submit} noValidate>
      <input
        ref={inputRef}
        className="task-row-input"
        value={draft}
        aria-label={copy.editTitleLabel}
        aria-invalid={message === copy.titleMissing ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        onChange={(event) => change(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="task-row-actions">
        <Button type="submit">{copy.saveButton}</Button>
        <Button variant="secondary" onClick={onCancel}>
          {copy.cancelButton}
        </Button>
      </div>
      {message ? (
        <p id={messageId} role="alert" className="field-error task-row-message">
          {message}
        </p>
      ) : null}
    </form>
  );
}

interface TaskRowViewProps {
  task: Task;
  completed: boolean;
  inactive: boolean;
  editRef: Ref<HTMLButtonElement>;
  onEdit: () => void;
  onDelete: () => void;
}

/** The read-only row: title, status as a word (never colour alone), then Edit and Delete. */
function TaskRowView({ task, completed, inactive, editRef, onEdit, onDelete }: TaskRowViewProps) {
  return (
    <>
      <div className="task-row-body">
        <span className="task-row-title">{task.title}</span>
        <span className="task-row-status">
          {completed ? copy.statusCompleted : copy.statusPending}
        </span>
      </div>
      <div className="task-row-actions">
        <Button variant="secondary" ref={editRef} disabled={inactive} onClick={onEdit}>
          {copy.editButton}
        </Button>
        <Button
          variant="danger"
          disabled={inactive}
          aria-label={`${copy.deleteButton} ${task.title}`}
          onClick={onDelete}
        >
          {copy.deleteButton}
        </Button>
      </div>
    </>
  );
}

/**
 * One task: a tick control, the title as plain text (or an input while editing) and the status as
 * a word, never colour alone (AC-2, AC-9). A row whose add is still unsaved ignores both controls.
 */
export function TaskRow({ task, onToggle, onEditTitle, onDelete, leaving = false }: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const completed = task.status === 'completed';
  const unsaved = isTempId(task.id);
  const inactive = unsaved || leaving;
  const classes = [
    'task-row',
    completed ? 'task-row--completed' : null,
    leaving ? 'task-row--leaving' : null,
  ]
    .filter(Boolean)
    .join(' ');

  // Leaving edit mode hands focus back to the Edit button.
  useEffect(() => {
    if (!editing && wasEditing.current) editRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const finish = (title?: string) => {
    setEditing(false);
    if (title !== undefined && title !== task.title) void onEditTitle(task.id, title);
  };

  return (
    <li className={classes} aria-hidden={leaving ? true : undefined}>
      <input
        type="checkbox"
        className="task-row-toggle"
        checked={completed}
        disabled={inactive}
        aria-label={completed ? copy.markNotCompleted(task.title) : copy.markCompleted(task.title)}
        onChange={() => void onToggle(task.id)}
      />
      {editing ? (
        <EditTitleForm
          id={task.id}
          initial={task.title}
          onSave={finish}
          onCancel={() => finish()}
        />
      ) : (
        <TaskRowView
          task={task}
          completed={completed}
          inactive={inactive}
          editRef={editRef}
          onEdit={() => setEditing(true)}
          onDelete={() => void onDelete(task.id)}
        />
      )}
    </li>
  );
}
