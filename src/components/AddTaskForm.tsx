import { useRef, useState, type FormEvent } from 'react';
import type { NewTask } from '../api/tasks';
import type { TaskPriority } from '../api/types';
import { copy, PRIORITY_OPTIONS } from '../copy';
import { isBeyondMax, maxDueDate } from '../lib/localDate';
import { clampTitle, validateTitle } from '../validation/title';
import { Button } from './Button';
import { SelectField } from './SelectField';
import { TextField } from './TextField';
import './AddTaskForm.css';

const DEFAULT_PRIORITY: TaskPriority = 'medium';

/** The task to add; a date left empty is not sent at all. */
const newTask = (title: string, dueDate: string, priority: TaskPriority): NewTask =>
  dueDate === '' ? { title, priority } : { title, dueDate, priority };

function dateErrorText(tooFar: boolean, incomplete: boolean): string | undefined {
  if (tooFar) return copy.dueDateTooFar;
  return incomplete ? copy.dueDateIncomplete : undefined;
}

/** The optional date box: its text, what is wrong with it, and a way to check it at submit. */
function useDueDateField(max: string) {
  const [dueDate, setDueDate] = useState('');
  const [incomplete, setIncomplete] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  // A typed date past the limit is refused here, whatever the box's own max does.
  const tooFar = dueDate !== '' && isBeyondMax(dueDate, max);
  const change = (raw: string) => {
    setDueDate(raw);
    setIncomplete(false);
  };
  const reset = () => change('');
  // A half-typed date reads as empty, so it would be added with no date: ask for the rest instead.
  const refuseHalfTyped = () => {
    const half = dueDate === '' && ref.current?.validity.badInput === true;
    if (half) setIncomplete(true);
    return half;
  };
  return {
    dueDate,
    ref,
    tooFar,
    error: dateErrorText(tooFar, incomplete),
    change,
    reset,
    refuseHalfTyped,
  };
}

interface AddTaskFormProps {
  onAdd: (task: NewTask) => void;
  /** The user's calendar date, which sets the furthest due date the box accepts. */
  today: string;
}

/**
 * Title, an optional due date and a priority (Medium preselected), then Add. Enter in any field or
 * the button submits; empty title adds nothing; input stops at 200. Skipping the date and priority
 * still adds in one step. Both extra fields reset after an add.
 */
export function AddTaskForm({ onAdd, today }: AddTaskFormProps) {
  const [value, setValue] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(DEFAULT_PRIORITY);
  const [limitMessage, setLimitMessage] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const max = maxDueDate(today);
  const date = useDueDateField(max);

  const change = (raw: string) => {
    const { value: clamped, truncated } = clampTitle(raw);
    setValue(clamped);
    setLimitMessage(truncated ? copy.titleTooLong : undefined);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const check = validateTitle(value);
    if (!check.ok || date.tooFar || date.refuseHalfTyped()) return;
    onAdd(newTask(check.title, date.dueDate, priority));
    setValue('');
    date.reset();
    setPriority(DEFAULT_PRIORITY);
    setLimitMessage(undefined);
    inputRef.current?.focus();
  };

  return (
    <form className="card add-task-form" onSubmit={submit} noValidate>
      <div className="add-task-title">
        <TextField
          id="new-task"
          label={copy.newTaskLabel}
          value={value}
          onChange={change}
          error={limitMessage}
          autoComplete="off"
          inputRef={inputRef}
        />
      </div>
      <TextField
        id="new-task-due"
        label={copy.dueDateLabel}
        type="date"
        value={date.dueDate}
        max={max}
        onChange={date.change}
        error={date.error}
        inputRef={date.ref}
        className="add-task-date"
      />
      <SelectField
        id="new-task-priority"
        label={copy.priorityLabel}
        value={priority}
        options={PRIORITY_OPTIONS}
        onChange={setPriority}
      />
      <Button type="submit" className="add-task-submit">
        {copy.addTask}
      </Button>
    </form>
  );
}
