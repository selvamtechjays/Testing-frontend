import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { Task } from '../api/types';
import { copy } from '../copy';
import { notesPanelId } from '../lib/notesPanelId';
import { NOTES_MAX, normaliseNotes, notesLeft } from '../validation/notes';
import { Button } from './Button';
import './TaskNotesPanel.css';

interface TaskNotesPanelProps {
  task: Task;
  /** The panel is animating out: hidden from assistive tech and inert. */
  leaving?: boolean;
  /** Stores these notes (null clears them); the row closes the panel after it. */
  onSave: (notes: string | null) => void;
  /** Closes without saving; `dirty` says whether the user had typed a change that is lost. */
  onClose: (dirty: boolean) => void;
  /** Tells the list whether the box holds an unsaved change. */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * The box's text, kept apart from the saved notes: it starts from them and follows a changed
 * saved value (a reload, a rollback) only while the box holds no unsaved change (R-3).
 */
function useNotesDraft(saved: string | null) {
  const [draft, setDraft] = useState(saved ?? '');
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    if (normaliseNotes(draft) === seen) setDraft(saved ?? '');
  }
  return { draft, setDraft, dirty: normaliseNotes(draft) !== saved };
}

interface ConfirmProps {
  taskId: string;
  onConfirm: () => void;
  onKeep: () => void;
}

/** In-panel confirmation, focused when it appears; no browser dialog. */
function ClearConfirmation({ taskId, onConfirm, onKeep }: ConfirmProps) {
  const textId = `task-${taskId}-notes-confirm`;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      role="group"
      tabIndex={-1}
      aria-labelledby={textId}
      className="task-notes-confirm"
    >
      <p id={textId} className="task-notes-confirm-text">
        {copy.clearNotesConfirm}
      </p>
      <div className="task-notes-actions">
        <Button variant="danger" onClick={onConfirm}>
          {copy.clearNotes}
        </Button>
        <Button variant="secondary" onClick={onKeep}>
          {copy.keepNotes}
        </Button>
      </div>
    </div>
  );
}

interface EditorProps {
  task: Task;
  draft: string;
  onDraft: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onAskClear: () => void;
  clearRef: RefObject<HTMLButtonElement | null>;
}

/** The textarea, its character count and Save, Cancel and Clear notes. */
function NotesEditor({
  task,
  draft,
  onDraft,
  onSave,
  onCancel,
  onAskClear,
  clearRef,
}: EditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const left = notesLeft(draft);
  const countId = `task-${task.id}-notes-count`;
  return (
    <>
      <textarea
        ref={inputRef}
        className="task-notes-input"
        rows={4}
        maxLength={NOTES_MAX}
        value={draft}
        aria-label={copy.notesTextLabel(task.title)}
        aria-describedby={countId}
        onChange={(event) => onDraft(event.target.value)}
      />
      <p id={countId} className="task-notes-count">
        {copy.notesCharsLeft(left)}
      </p>
      <p aria-live="polite" aria-atomic="true" className="task-notes-live">
        {left === 0 ? copy.notesCharsLeft(0) : ''}
      </p>
      <div className="task-notes-actions">
        <Button onClick={onSave}>{copy.saveButton}</Button>
        <Button variant="secondary" onClick={onCancel}>
          {copy.cancelButton}
        </Button>
        {task.notes !== null ? (
          <Button variant="danger" ref={clearRef} onClick={onAskClear}>
            {copy.clearNotes}
          </Button>
        ) : null}
      </div>
    </>
  );
}

/**
 * The notes panel (PAGE-TASK-01, DEC-238/239/242): a labelled box limited to 1000 characters,
 * a count of what is left, Save, Cancel and Clear notes with an in-panel confirmation.
 * Escape is handled on the panel itself, never on the document: in the confirmation it backs out
 * of it, elsewhere it closes like Cancel.
 */
export function TaskNotesPanel({
  task,
  leaving = false,
  onSave,
  onClose,
  onDirtyChange,
}: TaskNotesPanelProps) {
  const { draft, setDraft, dirty } = useNotesDraft(task.notes);
  const [confirming, setConfirming] = useState(false);
  const clearRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (wasConfirming.current && !confirming) clearRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const save = () => {
    const next = normaliseNotes(draft);
    if (next === task.notes) onClose(false);
    else onSave(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (confirming) setConfirming(false);
    else onClose(dirty);
  };

  return (
    <div
      id={notesPanelId(task.id)}
      role="group"
      aria-label={copy.notesPanelLabel(task.title)}
      className={['task-notes', leaving ? 'task-notes--leaving' : null].filter(Boolean).join(' ')}
      aria-hidden={leaving ? true : undefined}
      inert={leaving || undefined}
      onKeyDown={onKeyDown}
    >
      {confirming ? (
        <ClearConfirmation
          taskId={task.id}
          onConfirm={() => onSave(null)}
          onKeep={() => setConfirming(false)}
        />
      ) : (
        <NotesEditor
          task={task}
          draft={draft}
          onDraft={setDraft}
          onSave={save}
          onCancel={() => onClose(dirty)}
          onAskClear={() => setConfirming(true)}
          clearRef={clearRef}
        />
      )}
    </div>
  );
}
