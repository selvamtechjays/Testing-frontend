import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Tag, TagColour } from '../api/types';
import type { TagChanges } from '../api/tags';
import type { DeleteTagResult, UpdateTagResult } from '../tasks/tasksContext';

/** The same record without one key. */
function without<V>(record: Record<string, V>, key: string): Record<string, V> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** Rename text per tag (only while it differs from what is saved) and the server's message per tag. */
function useFieldState() {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setDraft = useCallback((id: string, text: string) => {
    setDrafts((before) => ({ ...before, [id]: text }));
    setErrors((before) => without(before, id));
  }, []);
  const clearDraft = useCallback((id: string) => setDrafts((before) => without(before, id)), []);
  const setError = useCallback(
    (id: string, message: string | undefined) =>
      setErrors((before) =>
        message === undefined ? without(before, id) : { ...before, [id]: message },
      ),
    [],
  );
  return { drafts, errors, setDraft, clearDraft, setError };
}

interface QuestionInput {
  panelRef: RefObject<HTMLDivElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  tags: Tag[];
}

/** The delete question for one tag at a time, and where focus goes when it closes. */
function useDeleteQuestion({ panelRef, headingRef, tags }: QuestionInput) {
  const [confirming, setConfirming] = useState<{ id: string; count: number } | null>(null);
  const focusBackTo = useRef<string | null>(null);

  // Once the question is gone, focus returns to that tag's Delete button, or to the heading when the tag is gone too.
  useEffect(() => {
    if (confirming !== null || focusBackTo.current === null) return;
    const id = focusBackTo.current;
    focusBackTo.current = null;
    const button = panelRef.current?.querySelector<HTMLElement>(`[data-delete-for="${id}"]`);
    (button ?? headingRef.current)?.focus();
  }, [confirming, tags, panelRef, headingRef]);

  const close = useCallback(() => {
    setConfirming((current) => {
      if (current !== null) focusBackTo.current = current.id;
      return null;
    });
  }, []);
  return { confirming, open: setConfirming, close };
}

/**
 * Which tags have a request in flight (their controls are off meanwhile), and the control that had
 * focus when one started: disabling it drops focus to the page, so it gets focus back once that
 * tag's controls are on again (keyboard use, BR-13).
 */
function useBusyTags(panelRef: RefObject<HTMLDivElement | null>) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const refocus = useRef<{ id: string; element: HTMLElement } | null>(null);

  useEffect(() => {
    const target = refocus.current;
    if (target === null || busy.has(target.id)) return;
    refocus.current = null;
    const { element } = target;
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (element.isConnected && lost) element.focus();
  }, [busy]);

  const start = useCallback(
    (id: string) => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && panelRef.current?.contains(active)) {
        refocus.current = { id, element: active };
      }
      setBusy((before) => new Set(before).add(id));
    },
    [panelRef],
  );
  const finish = useCallback((id: string) => {
    setBusy((before) => {
      const next = new Set(before);
      next.delete(id);
      return next;
    });
  }, []);
  return { busy, start, finish };
}

interface ManageInput {
  tags: Tag[];
  onUpdate: (id: string, changes: TagChanges) => Promise<UpdateTagResult>;
  onDelete: (id: string) => Promise<DeleteTagResult>;
  onFreshCount: (id: string) => Promise<number | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/** The panel's state and its server-first actions; nothing here touches a row until the server answers. */
export function useManageTags(input: ManageInput) {
  const { tags, onUpdate, onDelete, onFreshCount, panelRef, headingRef } = input;
  const fields = useFieldState();
  const question = useDeleteQuestion({ panelRef, headingRef, tags });
  const { busy, start, finish } = useBusyTags(panelRef);

  /** Runs one request for one tag with its controls off; resolves with whether the server accepted. */
  const run = async (id: string, request: () => Promise<{ ok: boolean; message?: string }>) => {
    start(id);
    const result = await request();
    finish(id);
    fields.setError(id, result.ok ? undefined : result.message);
    return result.ok;
  };

  const save = async (tag: Tag) => {
    const next = (fields.drafts[tag.id] ?? tag.name).trim();
    if (next !== tag.name && !(await run(tag.id, () => onUpdate(tag.id, { name: next })))) return;
    fields.clearDraft(tag.id);
  };

  const recolour = (tag: Tag, colour: TagColour) =>
    void run(tag.id, () => onUpdate(tag.id, { colour }));

  const askDelete = async (tag: Tag) => {
    start(tag.id);
    const count = await onFreshCount(tag.id);
    finish(tag.id);
    if (count !== null) question.open({ id: tag.id, count });
    // Gone elsewhere: its row (and the Delete button that had focus) leaves with the fresh list.
    else headingRef.current?.focus();
  };

  const remove = async (tag: Tag) => {
    await run(tag.id, () => onDelete(tag.id));
    question.close();
  };

  return {
    ...fields,
    confirming: question.confirming,
    closeQuestion: question.close,
    busy,
    save,
    recolour,
    askDelete,
    remove,
  };
}
