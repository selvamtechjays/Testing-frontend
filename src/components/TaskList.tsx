import { useCallback, useState } from 'react';
import type { Tag, Task, TaskPriority } from '../api/types';
import { copy } from '../copy';
import { exitDurationMs } from '../lib/motion';
import type { CreateTagResult, TagsStatus } from '../tasks/tasksContext';
import { TaskRow, type RowNotes, type RowTags } from './TaskRow';
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
  tags: Tag[];
  tagsStatus: TagsStatus;
  onChangeTags: (id: string, tagIds: string[]) => Promise<boolean>;
  onCreateTag: (taskId: string, name: string) => Promise<CreateTagResult>;
  onRetryTags: () => void;
  /** A saved row's chip was chosen: the Tag filter becomes that tag (the tag-filtering task). */
  onSelectTag?: (tagId: string) => void;
  /** The Manage tags panel is open: no row panel may be (one panel at a time, FEAT-TAG-02). */
  manageOpen?: boolean;
  /** A row panel was opened: the page closes the Manage tags panel. */
  onRowPanelOpened?: () => void;
}

/** Which row panel is open: one at a time across both kinds, notes or tags (ASM-052, ASM-070). */
interface OpenPanel {
  id: string;
  kind: 'notes' | 'tags';
}

/**
 * Which row's panel is open (one at a time), whether a notes panel holds an unsaved change, and the
 * one not-saved line. Every way a notes panel closes with a typed change lost sets the line
 * (DEC-238); opening a panel clears it, unless it replaced a notes panel holding a typed change.
 */
function useOpenPanel(openGone: (openId: string | null) => boolean) {
  const [open, setOpen] = useState<OpenPanel | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notSaved, setNotSaved] = useState(false);
  const notesDirty = open?.kind === 'notes' && dirty;

  const close = useCallback((lost: boolean) => {
    setOpen(null);
    setDirty(false);
    setNotSaved(lost);
  }, []);
  const toggle = (id: string, kind: OpenPanel['kind']) => {
    if (open?.id === id && open.kind === kind) {
      close(notesDirty);
      return;
    }
    // Switching away from a notes panel with a typed change loses it, and says so (DEC-238).
    setOpen({ id, kind });
    setDirty(false);
    setNotSaved(notesDirty);
  };
  // The open row left the list (deleted, or filtered out): its panel goes with it.
  if (open !== null && openGone(open.id)) close(notesDirty);
  return { open, toggle, close, setDirty, notSaved };
}

type PanelProps = Pick<
  TaskListProps,
  | 'onChangeNotes'
  | 'tags'
  | 'tagsStatus'
  | 'onChangeTags'
  | 'onCreateTag'
  | 'onRetryTags'
  | 'onSelectTag'
  | 'onRowPanelOpened'
>;

/** What each row is handed to drive its notes panel and its tags picker, from the one open-panel slot. */
function useRowPanels(isGone: (id: string | null) => boolean, props: PanelProps) {
  const { open, toggle, close, setDirty, notSaved } = useOpenPanel(isGone);
  const isOpen = (id: string, kind: OpenPanel['kind']) => open?.id === id && open.kind === kind;
  const toggleRow = (id: string, kind: OpenPanel['kind']) => {
    if (!isOpen(id, kind)) props.onRowPanelOpened?.();
    toggle(id, kind);
  };
  const notesFor = (id: string): RowNotes => ({
    open: isOpen(id, 'notes'),
    onToggle: () => toggleRow(id, 'notes'),
    onChange: props.onChangeNotes,
    onClose: close,
    onDirtyChange: setDirty,
  });
  const tagsFor = (id: string): RowTags => ({
    open: isOpen(id, 'tags'),
    onToggle: () => toggleRow(id, 'tags'),
    onClose: () => close(false),
    tags: props.tags,
    tagsStatus: props.tagsStatus,
    onChangeTags: props.onChangeTags,
    onCreate: props.onCreateTag,
    onRetryTags: props.onRetryTags,
    onSelect: props.onSelectTag,
  });
  return { notesFor, tagsFor, notSaved };
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
  manageOpen = false,
  ...panelProps
}: TaskListProps) {
  const [exitMs] = useState(exitDurationMs);
  const rows = useExitingItems(tasks, exitMs);
  const { notesFor, tagsFor, notSaved } = useRowPanels(
    (id) => manageOpen || !rows.some((row) => row.item.id === id && !row.leaving),
    panelProps,
  );
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
            tags={tagsFor(item.id)}
          />
        ))}
      </ul>
    </>
  );
}
