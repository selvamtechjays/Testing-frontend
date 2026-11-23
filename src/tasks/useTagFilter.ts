import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { ApiError } from '../api/client';
import type { ListFilters } from '../api/types';
import { copy } from '../copy';
import { useFailureNotice } from '../lib/FailureNoticeContext';
import { isTagId } from './listFilters';
import type { TagList } from './useTagList';

interface TagFilterInput {
  filters: ListFilters;
  /** The filters as of the latest change, readable synchronously by actions. */
  latest: RefObject<ListFilters>;
  setFilter: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  tagList: TagList;
}

/**
 * The Tag filter's life next to the shared tag list (DEC-265):
 * - a remembered tag id waits for the tag list, and one the list does not hold becomes Any before
 *   any filtered request goes out, with no message;
 * - a list request refused with a 400 naming `tag` shows the failure notice and refreshes the tags,
 *   and the filter returns to Any once the tag is gone from them;
 * - `selectTag` (a chip) and `tagDeleted` (Manage tags) set the filter without touching the rest.
 */
export function useTagFilter({ filters, latest, setFilter, tagList }: TagFilterInput) {
  const { tags, tagsStatus, tagsRef, refreshTags } = tagList;
  const { show } = useFailureNotice();
  const missing = isTagId(filters.tag) && !tags.some((tag) => tag.id === filters.tag);
  const hold =
    isTagId(filters.tag) && (tagsStatus === 'loading' || (tagsStatus === 'ready' && missing));

  useEffect(() => {
    if (tagsStatus === 'ready' && missing) setFilter('tag', 'any');
  }, [tagsStatus, missing, setFilter]);

  // Read by onRefused, which must keep one identity: the list request effect depends on it.
  const statusRef = useRef(tagsStatus);
  useEffect(() => {
    statusRef.current = tagsStatus;
  }, [tagsStatus]);

  const onRefused = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 400) return;
      if (error.fields.tag === undefined) return;
      void refreshTags();
      // The tag list never loaded, so a remembered tag went out unchecked: it is gone, which
      // reads as Any with no message, as when the list had loaded (BR-6).
      if (statusRef.current !== 'ready' && isTagId(latest.current.tag)) {
        setFilter('tag', 'any');
        return;
      }
      show(copy.saveFailed);
    },
    [show, refreshTags, latest, setFilter],
  );

  /** A chip's tag the list does not hold yet (made in another tab) is read in before filtering by it. */
  const selectTag = useCallback(
    (id: string) => {
      if (latest.current.tag === id) return;
      if (tagsRef.current.some((tag) => tag.id === id)) {
        setFilter('tag', id);
        return;
      }
      void refreshTags().then(() => setFilter('tag', id));
    },
    [latest, setFilter, tagsRef, refreshTags],
  );

  const tagDeleted = useCallback(
    (id: string) => {
      if (latest.current.tag === id) setFilter('tag', 'any');
    },
    [latest, setFilter],
  );

  return { hold, onRefused, selectTag, tagDeleted };
}

export type TagFilterState = ReturnType<typeof useTagFilter>;
