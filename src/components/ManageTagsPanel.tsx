import { useEffect, useRef, type KeyboardEvent } from 'react';
import { TAG_COLOURS, type Tag, type TagColour } from '../api/types';
import { copy } from '../copy';
import type { TagChanges } from '../api/tags';
import type { DeleteTagResult, UpdateTagResult } from '../tasks/tasksContext';
import { Button } from './Button';
import { SelectField, type SelectOption } from './SelectField';
import { TextField } from './TextField';
import { useManageTags } from './useManageTags';
import './ManageTagsPanel.css';

const COLOUR_OPTIONS: Array<SelectOption<TagColour>> = TAG_COLOURS.map((colour) => ({
  value: colour,
  label: copy.tagColourName(colour),
}));

interface ManageTagsPanelProps {
  tags: Tag[];
  onUpdate: (id: string, changes: TagChanges) => Promise<UpdateTagResult>;
  onDelete: (id: string) => Promise<DeleteTagResult>;
  /** The number of tasks carrying the tag, read from the server just now; null when it could not be read. */
  onFreshCount: (id: string) => Promise<number | null>;
  /** Reads the tag list again; called when the panel opens. */
  onRefresh: () => Promise<void> | void;
  onClose: () => void;
}

interface RowProps {
  tag: Tag;
  draft: string;
  error?: string;
  busy: boolean;
  onDraft: (text: string) => void;
  onSave: () => void;
  onColour: (colour: TagColour) => void;
  onAskDelete: () => void;
}

interface RenameProps {
  tag: Tag;
  draft: string;
  error?: string;
  busy: boolean;
  onDraft: (text: string) => void;
  onSave: () => void;
}

/** A swatch beside the name box (the name is always shown), then Save; Enter saves too. */
function RenameField({ tag, draft, error, busy, onDraft, onSave }: RenameProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onSave();
  };
  return (
    <div className="manage-tags-name">
      <span className={`manage-tags-swatch manage-tags-swatch--${tag.colour}`} aria-hidden="true" />
      <TextField
        id={`manage-tag-${tag.id}-name`}
        label={copy.tagNameLabel(tag.name)}
        labelHidden
        className="manage-tags-field"
        value={draft}
        disabled={busy}
        error={error}
        onChange={onDraft}
        onKeyDown={onKeyDown}
      />
      <Button
        variant="secondary"
        disabled={busy}
        aria-label={copy.tagSaveLabel(tag.name)}
        onClick={onSave}
      >
        {copy.saveButton}
      </Button>
    </div>
  );
}

/** One tag: a swatch beside its name box (the name is always shown), the count, the colour and Delete. */
function ManageTagRow({
  tag,
  draft,
  error,
  busy,
  onDraft,
  onSave,
  onColour,
  onAskDelete,
}: RowProps) {
  return (
    <>
      <RenameField
        tag={tag}
        draft={draft}
        error={error}
        busy={busy}
        onDraft={onDraft}
        onSave={onSave}
      />
      <p className="manage-tags-count">{copy.tagTaskCount(tag.taskCount)}</p>
      <SelectField
        id={`manage-tag-${tag.id}-colour`}
        label={copy.tagColourLabel(tag.name)}
        labelHidden
        value={tag.colour}
        options={COLOUR_OPTIONS}
        disabled={busy}
        onChange={onColour}
      />
      <Button
        variant="danger"
        disabled={busy}
        data-delete-for={tag.id}
        aria-label={copy.tagDeleteLabel(tag.name)}
        onClick={onAskDelete}
      >
        {copy.deleteButton}
      </Button>
    </>
  );
}

interface ConfirmProps {
  tag: Tag;
  count: number;
  busy: boolean;
  onDelete: () => void;
  onKeep: () => void;
}

/** The delete question, in the panel itself and focused when it appears: no browser dialog. */
function ConfirmDelete({ tag, count, busy, onDelete, onKeep }: ConfirmProps) {
  const ref = useRef<HTMLDivElement>(null);
  const textId = `manage-tag-${tag.id}-confirm`;
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      role="group"
      tabIndex={-1}
      aria-labelledby={textId}
      className="manage-tags-confirm"
    >
      <p id={textId} className="manage-tags-confirm-text">
        {copy.tagDeleteQuestion(tag.name, count)}
      </p>
      <div className="manage-tags-actions">
        <Button variant="danger" disabled={busy} onClick={onDelete}>
          {copy.tagDeleteConfirm}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onKeep}>
          {copy.tagKeep}
        </Button>
      </div>
    </div>
  );
}

/** One tag's row: its controls, or the delete question in their place. */
function TagRow({ tag, state }: { tag: Tag; state: ReturnType<typeof useManageTags> }) {
  const { confirming, busy } = state;
  return (
    <div role="group" aria-label={copy.tagRowLabel(tag.name)} className="manage-tags-row">
      {confirming?.id === tag.id ? (
        <ConfirmDelete
          tag={tag}
          count={confirming.count}
          busy={busy.has(tag.id)}
          onDelete={() => void state.remove(tag)}
          onKeep={state.closeQuestion}
        />
      ) : (
        <ManageTagRow
          tag={tag}
          draft={state.drafts[tag.id] ?? tag.name}
          error={state.errors[tag.id]}
          busy={busy.has(tag.id)}
          onDraft={(text) => state.setDraft(tag.id, text)}
          onSave={() => void state.save(tag)}
          onColour={(colour) => state.recolour(tag, colour)}
          onAskDelete={() => void state.askDelete(tag)}
        />
      )}
    </div>
  );
}

/**
 * The Manage tags panel (PAGE-TASK-01): every tag with its colour, name and task count. Rename,
 * recolour and delete are server-first: nothing here or on any row changes until the server
 * accepts, and a refusal shows the server's message beside the field (FEAT-TAG-02). Escape is
 * handled on the panel: it closes the delete question first, then the panel.
 */
export function ManageTagsPanel({ tags, onRefresh, onClose, ...actions }: ManageTagsPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const state = useManageTags({ tags, panelRef, headingRef, ...actions });
  const { confirming } = state;

  useEffect(() => {
    void onRefresh();
    headingRef.current?.focus();
  }, [onRefresh]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (confirming) state.closeQuestion();
    else onClose();
  };

  return (
    <div
      ref={panelRef}
      id="manage-tags-panel"
      role="group"
      aria-labelledby="manage-tags-heading"
      className="card manage-tags"
      onKeyDown={onKeyDown}
    >
      <div className="manage-tags-head">
        <h2 id="manage-tags-heading" ref={headingRef} tabIndex={-1} className="manage-tags-title">
          {copy.manageTagsHeading}
        </h2>
        <Button variant="secondary" onClick={onClose}>
          {copy.manageTagsClose}
        </Button>
      </div>
      {tags.length === 0 ? <p className="manage-tags-empty">{copy.manageTagsEmpty}</p> : null}
      {tags.map((tag) => (
        <TagRow key={tag.id} tag={tag} state={state} />
      ))}
    </div>
  );
}
