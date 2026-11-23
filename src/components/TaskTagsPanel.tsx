import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Tag, Task } from '../api/types';
import { copy } from '../copy';
import { tagsPanelId } from '../lib/notesPanelId';
import type { CreateTagResult, TagsStatus } from '../tasks/tasksContext';
import { TASK_TAG_LIMIT, USER_TAG_LIMIT } from '../tasks/tagLimits';
import { Button } from './Button';
import { TextField } from './TextField';
import './TagChips.css';
import './TaskTagsPanel.css';

interface TaskTagsPanelProps {
  task: Task;
  tags: Tag[];
  tagsStatus: TagsStatus;
  /** The panel is animating out: hidden from assistive tech and inert. */
  leaving?: boolean;
  /** Ticks or unticks one tag; the row sends the task's new full list. */
  onToggle: (tagId: string) => void;
  /** Create tag, Enter: resolves with the outcome so the field can clear or show the server's reason. */
  onCreate: (name: string) => Promise<CreateTagResult>;
  onRetryTags: () => void;
  onClose: () => void;
}

interface OptionsProps {
  task: Task;
  tags: Tag[];
  full: boolean;
  onToggle: (tagId: string) => void;
}

/** One checkbox per tag, named by the tag; at the task's limit the unticked ones are off. */
function TagOptions({ task, tags, full, onToggle }: OptionsProps) {
  const ticked = new Set(task.tags.map((tag) => tag.id));
  return (
    <fieldset className="task-tags-options">
      <legend className="task-tags-legend">{copy.tagsListLabel(task.title)}</legend>
      {tags.map((tag) => (
        <label key={tag.id} className="task-tags-option">
          <input
            type="checkbox"
            className="task-tags-check"
            checked={ticked.has(tag.id)}
            disabled={full && !ticked.has(tag.id)}
            onChange={() => onToggle(tag.id)}
          />
          <span className={`tag-chip tag-chip--${tag.colour}`} title={tag.name}>
            {tag.name}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

interface CreateFieldProps {
  taskId: string;
  disabled: boolean;
  onCreate: (name: string) => Promise<CreateTagResult>;
}

/** The Create tag box: Enter sends what was typed as typed; the server trims and judges it. */
function CreateTagField({ taskId, disabled, onCreate }: CreateFieldProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  const submit = async () => {
    if (sending.current) return;
    sending.current = true;
    const result = await onCreate(draft);
    sending.current = false;
    setError(result.message ?? null);
    if (result.ok) setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void submit();
  };

  return (
    <TextField
      id={`task-${taskId}-tag-create`}
      label={copy.tagCreateLabel}
      value={draft}
      disabled={disabled}
      hint={disabled ? copy.tagsUserLimit : undefined}
      error={error ?? undefined}
      onChange={(text) => {
        setDraft(text);
        setError(null);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

/**
 * The tags picker (PAGE-TASK-01): a checkbox per tag, a note at 5 tags and a Create tag box.
 * Escape is handled on the panel itself, never on the document, and closes it.
 */
export function TaskTagsPanel({
  task,
  tags,
  tagsStatus,
  leaving = false,
  onToggle,
  onCreate,
  onRetryTags,
  onClose,
}: TaskTagsPanelProps) {
  const full = task.tags.length >= TASK_TAG_LIMIT;
  const panelRef = useRef<HTMLDivElement>(null);
  // Focus the first enabled control once, when the panel shows its controls (a checkbox, else the Create tag box).
  useEffect(() => {
    if (tagsStatus === 'ready')
      panelRef.current?.querySelector<HTMLElement>('input:not(:disabled)')?.focus();
  }, [tagsStatus]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };

  return (
    <div
      ref={panelRef}
      id={tagsPanelId(task.id)}
      role="group"
      aria-label={copy.tagsPanelLabel(task.title)}
      className={['task-tags', leaving ? 'task-tags--leaving' : null].filter(Boolean).join(' ')}
      aria-hidden={leaving ? true : undefined}
      inert={leaving || undefined}
      onKeyDown={onKeyDown}
    >
      {tagsStatus === 'loading' ? <p className="task-tags-note">{copy.tagsLoading}</p> : null}
      {tagsStatus === 'failed' ? (
        <div className="task-tags-note">
          <p role="alert">{copy.tagsLoadFailed}</p>
          <Button variant="secondary" onClick={onRetryTags}>
            {copy.retry}
          </Button>
        </div>
      ) : null}
      {tagsStatus === 'ready' ? (
        <>
          {tags.length > 0 ? (
            <TagOptions task={task} tags={tags} full={full} onToggle={onToggle} />
          ) : null}
          {full ? <p className="task-tags-note">{copy.tagsTaskLimit}</p> : null}
          <CreateTagField
            taskId={task.id}
            disabled={tags.length >= USER_TAG_LIMIT}
            onCreate={onCreate}
          />
        </>
      ) : null}
    </div>
  );
}
