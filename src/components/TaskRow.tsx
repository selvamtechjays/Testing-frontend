import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import type { Task, TaskPriority } from '../api/types';
import { copy, PRIORITY_OPTIONS } from '../copy';
import { dueState, formatDueDate, isBeyondMax, maxDueDate } from '../lib/localDate';
import { exitDurationMs } from '../lib/motion';
import { notesPanelId } from '../lib/notesPanelId';
import { isTempId } from '../tasks/taskState';
import { clampTitle, validateTitle } from '../validation/title';
import { Button } from './Button';
import { SelectField } from './SelectField';
import { TaskNotesPanel } from './TaskNotesPanel';
import { TextField } from './TextField';
import { useExitingItems } from './useExitingItems';
import './TaskRow.css';

/** How the list drives this row's notes panel; a row given none shows no Notes button. */
export interface RowNotes {
  /** This row's panel is the open one. */
  open: boolean;
  /** The Notes button was pressed: opens the panel, or closes it as Cancel does. */
  onToggle: () => void;
  onChange: (id: string, notes: string | null) => Promise<boolean>;
  /** The panel closed without saving; `dirty` says a typed change was lost. */
  onClose: (dirty: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
}

interface TaskRowProps {
  task: Task;
  /** The user's calendar date, which decides the Overdue and Due today words. */
  today: string;
  onToggle: (id: string) => Promise<boolean>;
  onEditTitle: (id: string, title: string) => Promise<boolean>;
  onChangeDueDate: (id: string, dueDate: string | null) => Promise<boolean>;
  onChangePriority: (id: string, priority: TaskPriority) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  notes?: RowNotes;
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

/** The words under the title: status, priority and, when there is a date, how it stands (never colour alone). */
function dueText(task: Task, today: string): string | null {
  const state = dueState(task, today);
  if (state === 'overdue') return copy.dueOverdue;
  if (state === 'today') return copy.dueToday;
  return task.dueDate === null ? null : copy.dueOn(formatDueDate(task.dueDate));
}

interface NotesButtonProps {
  ref: Ref<HTMLButtonElement>;
  open: boolean;
  panelId: string;
  onClick: () => void;
}

/** The Notes button: named for its task, and pointing at the panel while that is open. */
function NotesButton({
  title,
  disabled,
  ref,
  open,
  panelId,
  onClick,
}: NotesButtonProps & { title: string; disabled: boolean }) {
  return (
    <Button
      variant="secondary"
      ref={ref}
      disabled={disabled}
      aria-label={copy.notesButtonLabel(title)}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={onClick}
    >
      {copy.notesButton}
    </Button>
  );
}

interface TaskRowViewProps {
  task: Task;
  today: string;
  completed: boolean;
  inactive: boolean;
  editRef: Ref<HTMLButtonElement>;
  notesButton: NotesButtonProps | null;
  onEdit: () => void;
  onDelete: () => void;
}

/** The read-only row: title, status as a word (never colour alone), then Edit and Delete. */
function TaskRowView({
  task,
  today,
  completed,
  inactive,
  editRef,
  notesButton,
  onEdit,
  onDelete,
}: TaskRowViewProps) {
  const due = dueText(task, today);
  const state = dueState(task, today);
  return (
    <>
      <div className="task-row-body">
        <span className="task-row-title">{task.title}</span>
        <div className="task-row-meta">
          <span className="task-row-status">
            {completed ? copy.statusCompleted : copy.statusPending}
          </span>
          <span className="task-row-chip">{copy.priorityWord(task.priority)}</span>
          {task.notes !== null ? <span className="task-row-chip">{copy.hasNotes}</span> : null}
          {due ? (
            <span
              className={['task-row-chip', state === 'overdue' ? 'task-row-chip--overdue' : null]
                .filter(Boolean)
                .join(' ')}
            >
              {due}
            </span>
          ) : null}
        </div>
      </div>
      <div className="task-row-actions">
        <Button variant="secondary" ref={editRef} disabled={inactive} onClick={onEdit}>
          {copy.editButton}
        </Button>
        {notesButton ? (
          <NotesButton title={task.title} disabled={inactive} {...notesButton} />
        ) : null}
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

interface RowFieldsProps {
  task: Task;
  today: string;
  disabled: boolean;
  onChangeDueDate: (dueDate: string | null) => void;
  onChangePriority: (priority: TaskPriority) => void;
}

const FULL_DATE = /^(\d{4})-\d{2}-\d{2}$/;
/** A typed year below this is a half-typed one (0002-..), never a date the person meant. */
const MIN_TYPED_YEAR = 1000;

function isCompleteDate(value: string): boolean {
  const match = FULL_DATE.exec(value);
  return match !== null && Number(match[1]) >= MIN_TYPED_YEAR;
}

/**
 * The date box's text while it is being typed, kept apart from the saved date: it follows the
 * task's date whenever that changes, and goes back to it when what was typed is not a full date.
 */
function useDateDraft(stored: string | null) {
  const storedText = stored ?? '';
  const [draft, setDraft] = useState(storedText);
  const [seen, setSeen] = useState(storedText);
  if (seen !== storedText) {
    setSeen(storedText);
    setDraft(storedText);
  }
  return { draft, setDraft, storedText };
}

/**
 * Date and priority edits; the date saves when the box is left or Enter is pressed, never
 * mid-typing, and a date past the five-year limit is refused with a message instead.
 */
function RowFields({ task, today, disabled, onChangeDueDate, onChangePriority }: RowFieldsProps) {
  const { draft, setDraft, storedText } = useDateDraft(task.dueDate);
  // The text that was refused; the message shows only while the box still holds exactly that text,
  // so typing, Clear date, a rollback or a reload (all of which change the box) drop it.
  const [refused, setRefused] = useState<string | null>(null);
  const tooFar = refused !== null && refused === draft;
  const max = maxDueDate(today);

  const settle = () => {
    if (isCompleteDate(draft) && isBeyondMax(draft, max)) {
      setRefused(draft);
    } else if (isCompleteDate(draft) && draft !== storedText) {
      onChangeDueDate(draft);
    } else {
      setDraft(storedText);
    }
  };

  const onDateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') settle();
  };

  return (
    <div className="task-row-fields">
      <TextField
        id={`task-${task.id}-due`}
        label={copy.rowDueDateLabel(task.title)}
        labelHidden
        type="date"
        className="task-row-date"
        value={draft}
        max={max}
        disabled={disabled}
        error={tooFar ? copy.dueDateTooFar : undefined}
        onChange={setDraft}
        onBlur={settle}
        onKeyDown={onDateKeyDown}
      />
      <Button
        variant="secondary"
        disabled={disabled || task.dueDate === null}
        aria-label={copy.rowClearDateLabel(task.title)}
        onClick={() => onChangeDueDate(null)}
      >
        {copy.clearDate}
      </Button>
      <SelectField
        id={`task-${task.id}-priority`}
        label={copy.rowPriorityLabel(task.title)}
        labelHidden
        value={task.priority}
        options={PRIORITY_OPTIONS}
        disabled={disabled}
        onChange={onChangePriority}
      />
    </div>
  );
}

/** Leaving edit mode hands focus back to the Edit button; returns the ref that button takes. */
function useReturnFocus(editing: boolean) {
  const editRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!editing && wasEditing.current) editRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  return editRef;
}

/**
 * The Notes button and the panel under the row. Leaving the panel by Save, Cancel, Escape or the
 * button hands focus back to the button; being closed because another row opened does not.
 */
function useNotesRow(task: Task, notes: RowNotes | undefined) {
  const open = notes?.open ?? false;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const wasOpen = useRef(false);
  const [exitMs] = useState(exitDurationMs);
  const items = useMemo(() => (open ? [{ id: notesPanelId(task.id) }] : []), [open, task.id]);
  const shown = useExitingItems(items, exitMs);

  useEffect(() => {
    if (wasOpen.current && !open && refocus.current) buttonRef.current?.focus();
    if (!open) refocus.current = false;
    wasOpen.current = open;
  }, [open]);

  if (!notes) return { notesButton: null, panel: null };
  const handBack = () => {
    refocus.current = true;
  };
  const notesButton = {
    ref: buttonRef,
    open,
    panelId: notesPanelId(task.id),
    onClick: () => {
      if (open) handBack();
      notes.onToggle();
    },
  };
  const panel = shown.map(({ item, leaving }) => (
    <TaskNotesPanel
      key={item.id}
      task={task}
      leaving={leaving}
      onSave={(value) => {
        handBack();
        notes.onClose(false);
        void notes.onChange(task.id, value);
      }}
      onClose={(dirty) => {
        handBack();
        notes.onClose(dirty);
      }}
      onDirtyChange={notes.onDirtyChange}
    />
  ));
  return { notesButton, panel };
}

/** The tick control, named for its task: Mark as completed, or as not completed. */
function TickBox({
  task,
  disabled,
  onToggle,
}: {
  task: Task;
  disabled: boolean;
  onToggle: () => void;
}) {
  const completed = task.status === 'completed';
  return (
    <input
      type="checkbox"
      className="task-row-toggle"
      checked={completed}
      disabled={disabled}
      aria-label={completed ? copy.markNotCompleted(task.title) : copy.markCompleted(task.title)}
      onChange={onToggle}
    />
  );
}

function rowClasses(completed: boolean, leaving: boolean): string {
  return [
    'task-row',
    completed ? 'task-row--completed' : null,
    leaving ? 'task-row--leaving' : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * One task: a tick control, the title as plain text (or an input while editing) and the status as
 * a word, never colour alone (AC-2, AC-9). A row whose add is still unsaved ignores both controls.
 */
export function TaskRow({
  task,
  today,
  onToggle,
  onEditTitle,
  onChangeDueDate,
  onChangePriority,
  onDelete,
  notes,
  leaving = false,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const editRef = useReturnFocus(editing);
  const completed = task.status === 'completed';
  const unsaved = isTempId(task.id);
  const inactive = unsaved || leaving;
  const classes = rowClasses(completed, leaving);
  const { notesButton, panel } = useNotesRow(task, notes);

  const finish = (title?: string) => {
    setEditing(false);
    if (title !== undefined && title !== task.title) void onEditTitle(task.id, title);
  };

  return (
    <li className={classes} aria-hidden={leaving ? true : undefined}>
      <TickBox task={task} disabled={inactive} onToggle={() => void onToggle(task.id)} />
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
          today={today}
          completed={completed}
          inactive={inactive}
          editRef={editRef}
          notesButton={notesButton}
          onEdit={() => setEditing(true)}
          onDelete={() => void onDelete(task.id)}
        />
      )}
      <RowFields
        task={task}
        today={today}
        disabled={inactive}
        onChangeDueDate={(dueDate) => void onChangeDueDate(task.id, dueDate)}
        onChangePriority={(priority) => void onChangePriority(task.id, priority)}
      />
      {panel}
    </li>
  );
}
