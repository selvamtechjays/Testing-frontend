import { useCallback, type RefObject } from 'react';
import { ApiError, isSessionEnd } from '../api/client';
import { deleteTag as deleteTagRequest, updateTag as updateTagRequest } from '../api/tags';
import type { TagChanges } from '../api/tags';
import type { Task } from '../api/types';
import { copy } from '../copy';
import { useFailureNotice } from '../lib/FailureNoticeContext';
import { withSaveTimeout } from '../lib/useInstantUpdate';
import type { DeleteTagResult, UpdateTagResult } from './tasksContext';
import { sameTags, sortByName } from './taskState';
import type { TagList } from './useTagList';

/** The message beside the field for a 400: the field the server named, else its own message. */
function refusalMessage(error: ApiError): string | undefined {
  const { name, colour, body } = error.fields;
  return name ?? colour ?? body ?? (error.message || undefined);
}

interface ManagementInput {
  commit: (change: (list: Task[]) => Task[]) => void;
  /** What the server last confirmed per task; a rename or delete must reach it too, or a rollback undoes it. */
  confirmed: RefObject<Map<string, { tags: Task['tags'] }>>;
  tagList: TagList;
  /** Tells the Tag filter a tag is gone (it returns to Any when it was that tag). */
  tagDeleted: (id: string) => void;
}

/**
 * Applies one change to every task's tags (and the confirmed copies), so rows and panel agree. A row
 * the change leaves as it was keeps its own array, so a tag save in flight on it still recognises it.
 */
export function useRetag({ commit, confirmed }: Pick<ManagementInput, 'commit' | 'confirmed'>) {
  return useCallback(
    (change: (tags: Task['tags']) => Task['tags']) => {
      const apply = (tags: Task['tags']) => {
        const next = change(tags);
        return sameTags(next, tags) ? tags : next;
      };
      commit((list) =>
        list.map((task) => {
          const tags = apply(task.tags);
          return tags === task.tags ? task : { ...task, tags };
        }),
      );
      confirmed.current.forEach((stored) => {
        stored.tags = apply(stored.tags);
      });
    },
    [commit, confirmed],
  );
}

/** A failure that is not a 400: a 404 means the tag is gone elsewhere (refresh quietly), a 401 is routed once elsewhere. */
function useSettleFailure(refreshTags: () => Promise<void>) {
  const { show } = useFailureNotice();
  return useCallback(
    async (error: unknown): Promise<{ ok: false; notFound?: boolean }> => {
      if (!isSessionEnd(error)) show(copy.saveFailed);
      if (!(error instanceof ApiError && error.status === 404)) return { ok: false };
      await refreshTags();
      return { ok: false, notFound: true };
    },
    [show, refreshTags],
  );
}

/**
 * Rename, recolour and delete of a tag, all server-first: nothing on screen changes until the server
 * accepts, then one update changes the tag list and every task chips together (FEAT-TAG-02).
 */
export function useTagManagement({ commit, confirmed, tagList, tagDeleted }: ManagementInput) {
  const { tagsRef, store, readTags, refreshTags } = tagList;
  const { show } = useFailureNotice();
  const retag = useRetag({ commit, confirmed });
  const settleFailure = useSettleFailure(refreshTags);

  const updateTag = useCallback(
    async (id: string, changes: TagChanges): Promise<UpdateTagResult> => {
      try {
        const saved = await withSaveTimeout((signal) => updateTagRequest(id, changes, signal));
        store(tagsRef.current.map((tag) => (tag.id === id ? saved : tag)));
        const own = { id, name: saved.name, colour: saved.colour };
        retag((tags) => sortByName(tags.map((tag) => (tag.id === id ? own : tag))));
        return { ok: true };
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          return { ok: false, message: refusalMessage(error) };
        }
        return settleFailure(error);
      }
    },
    [store, tagsRef, retag, settleFailure],
  );

  const deleteTag = useCallback(
    async (id: string): Promise<DeleteTagResult> => {
      try {
        await withSaveTimeout((signal) => deleteTagRequest(id, signal));
        store(tagsRef.current.filter((tag) => tag.id !== id));
        retag((tags) => tags.filter((tag) => tag.id !== id));
        tagDeleted(id);
        return { ok: true };
      } catch (error) {
        return settleFailure(error);
      }
    },
    [store, tagsRef, retag, tagDeleted, settleFailure],
  );

  /**
   * How many tasks carry the tag, read from the server just now. Null, with the failure message,
   * when it could not be read or the tag is gone (deleted elsewhere; the fresh list drops its row).
   */
  const freshTaskCount = useCallback(
    async (id: string): Promise<number | null> => {
      const count = (await readTags())?.find((tag) => tag.id === id)?.taskCount;
      if (count !== undefined) return count;
      show(copy.saveFailed);
      return null;
    },
    [readTags, show],
  );

  return { updateTag, deleteTag, freshTaskCount };
}
