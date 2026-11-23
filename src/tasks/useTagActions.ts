import { useCallback, type RefObject } from 'react';
import { ApiError, isSessionEnd } from '../api/client';
import { createTag } from '../api/tags';
import type { Tag, Task, TaskTag } from '../api/types';
import { copy } from '../copy';
import { useFailureNotice } from '../lib/FailureNoticeContext';
import { withSaveTimeout } from '../lib/useInstantUpdate';
import type { CreateTagResult } from './tasksContext';
import { TAG_NAME_MAX, TASK_TAG_LIMIT } from './tagLimits';
import { sameTags, tagsForIds } from './taskState';
import { useRetag } from './useTagManagement';
import type { TagList } from './useTagList';

/** The shared optimistic change, narrowed to the one field this file sets. */
type ChangeTags = (
  id: string,
  field: 'tags',
  value: TaskTag[],
  onRefused?: (error: unknown) => void,
) => Promise<boolean>;

/** A 400 naming `tagIds`: a tag sent no longer exists, so the tag list on screen is out of date. */
function isTagRefusal(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400 && error.fields.tagIds !== undefined;
}

/** The tag whose name matches this text ignoring case, or undefined. */
function findByName(tags: Tag[], text: string): Tag | undefined {
  const wanted = text.toLowerCase();
  return text === '' ? undefined : tags.find((tag) => tag.name.toLowerCase() === wanted);
}

interface TagActionsInput {
  listRef: RefObject<Task[]>;
  commit: (change: (list: Task[]) => Task[]) => void;
  /** What the server last confirmed per task; a tag gone from the server must leave it too. */
  confirmed: RefObject<Map<string, { tags: TaskTag[] }>>;
  changeField: ChangeTags;
  tagList: TagList;
}

/** Reads the tags again and drops, from every row, any tag the server no longer holds (BR-15). */
function useDropStaleTags({ commit, confirmed, tagList }: TagActionsInput) {
  const { readTags } = tagList;
  const retag = useRetag({ commit, confirmed });
  return useCallback(async () => {
    const fresh = await readTags();
    if (fresh === null) return;
    const known = new Set(fresh.map((tag) => tag.id));
    retag((tags) => tags.filter((tag) => known.has(tag.id)));
  }, [readTags, retag]);
}

/** Sets a task's tags to these ids; a refusal naming a tag that is gone drops it everywhere. */
function useChangeTags(input: TagActionsInput) {
  const { listRef, changeField, tagList } = input;
  const { tagsRef } = tagList;
  const dropStaleTags = useDropStaleTags(input);
  return useCallback(
    (id: string, tagIds: string[]): Promise<boolean> => {
      const current = listRef.current.find((task) => task.id === id);
      if (!current) return Promise.resolve(false);
      const next = tagsForIds(tagsRef.current, tagIds, current.tags);
      if (sameTags(current.tags, next)) return Promise.resolve(true);
      return changeField(id, 'tags', next, (error) => {
        if (isTagRefusal(error)) void dropStaleTags();
      });
    },
    [listRef, changeField, tagsRef, dropStaleTags],
  );
}

/** Setting a task's tags, and the picker's Create tag: match, or create gray and tick. */
export function useTagActions(input: TagActionsInput) {
  const { listRef, tagList } = input;
  const { tagsRef, refreshTags, addTag } = tagList;
  const { show } = useFailureNotice();
  const changeTags = useChangeTags(input);

  /** Adds one tag to a task; a task already at the limit is a failed change, with no request. */
  const tick = useCallback(
    async (taskId: string, tag: Tag): Promise<CreateTagResult> => {
      const task = listRef.current.find((row) => row.id === taskId);
      if (!task) return { ok: false };
      if (task.tags.some((own) => own.id === tag.id)) return { ok: true };
      if (task.tags.length >= TASK_TAG_LIMIT) {
        show(copy.saveFailed);
        return { ok: false };
      }
      return { ok: await changeTags(taskId, [...task.tags.map((own) => own.id), tag.id]) };
    },
    [listRef, changeTags, show],
  );

  /** A refused create: a stale duplicate ticks the match, a name rule shows the server's message. */
  const settleRefusal = useCallback(
    async (error: unknown, taskId: string, typed: string): Promise<CreateTagResult> => {
      if (error instanceof ApiError && error.status === 400 && error.fields.name !== undefined) {
        if (typed !== '' && typed.length <= TAG_NAME_MAX) {
          await refreshTags();
          const match = findByName(tagsRef.current, typed);
          if (match) return tick(taskId, match);
        }
        return { ok: false, message: error.fields.name };
      }
      if (!isSessionEnd(error)) show(copy.saveFailed);
      return { ok: false };
    },
    [refreshTags, tagsRef, tick, show],
  );

  const createTagAndTick = useCallback(
    async (taskId: string, name: string): Promise<CreateTagResult> => {
      const match = findByName(tagsRef.current, name.trim());
      if (match) return tick(taskId, match);
      try {
        const tag = await withSaveTimeout((signal) => createTag({ name }, signal));
        addTag(tag);
        return await tick(taskId, tag);
      } catch (error) {
        return settleRefusal(error, taskId, name.trim());
      }
    },
    [tagsRef, tick, addTag, settleRefusal],
  );

  return { changeTags, createTagAndTick };
}
