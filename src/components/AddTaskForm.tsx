import { useRef, useState, type FormEvent } from 'react';
import { copy } from '../copy';
import { clampTitle, validateTitle } from '../validation/title';
import { Button } from './Button';
import { TextField } from './TextField';
import './AddTaskForm.css';

interface AddTaskFormProps {
  onAdd: (title: string) => void;
}

/** Title field plus Add. Enter or the button submits; empty adds nothing; input stops at 200. */
export function AddTaskForm({ onAdd }: AddTaskFormProps) {
  const [value, setValue] = useState('');
  const [limitMessage, setLimitMessage] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const change = (raw: string) => {
    const { value: clamped, truncated } = clampTitle(raw);
    setValue(clamped);
    setLimitMessage(truncated ? copy.titleTooLong : undefined);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const check = validateTitle(value);
    if (!check.ok) return;
    onAdd(check.title);
    setValue('');
    setLimitMessage(undefined);
    inputRef.current?.focus();
  };

  return (
    <form className="card add-task-form" onSubmit={submit} noValidate>
      <TextField
        id="new-task"
        label={copy.newTaskLabel}
        value={value}
        onChange={change}
        error={limitMessage}
        autoComplete="off"
        inputRef={inputRef}
      />
      <Button type="submit" className="add-task-submit">
        {copy.addTask}
      </Button>
    </form>
  );
}
