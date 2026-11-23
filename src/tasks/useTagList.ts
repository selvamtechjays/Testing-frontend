import { useCallback, useEffect, useRef, useState } from 'react';
import { listTags } from '../api/tags';
import { withSaveTimeout } from '../lib/useInstantUpdate';
import type { Tag } from '../api/types';
import type { TagsStatus } from './tasksContext';
import { sortByName } from './taskState';

/**
 * The user's tag list, loaded once when the provider mounts (after sign-in) and read again quietly
 * whenever a 400 or 404 about a tag shows it is out of date (DEC-265). A failed read keeps what is
 * there; only a first read that fails reads as 'failed'.
 */
export function useTagList() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsStatus, setStatus] = useState<TagsStatus>('loading');
  // Readable synchronously by actions, which run between renders.
  const tagsRef = useRef<Tag[]>([]);

  /** Replaces the whole list (sorted by name). */
  const store = useCallback((next: Tag[]) => {
    tagsRef.current = sortByName(next);
    setTags(tagsRef.current);
  }, []);

  /** Reads the list from the server and keeps it; resolves with it, or null when the read failed. */
  const readTags = useCallback(async (): Promise<Tag[] | null> => {
    try {
      const list = await withSaveTimeout((signal) => listTags(signal));
      store(list);
      setStatus('ready');
      return tagsRef.current;
    } catch {
      setStatus((before) => (before === 'ready' ? 'ready' : 'failed'));
      return null;
    }
  }, [store]);

  const refreshTags = useCallback(async () => {
    await readTags();
  }, [readTags]);

  /** Adds a tag the server just created, without waiting for a read. */
  const addTag = useCallback((tag: Tag) => store([...tagsRef.current, tag]), [store]);

  useEffect(() => {
    void refreshTags();
  }, [refreshTags]);

  return { tags, tagsStatus, tagsRef, store, readTags, refreshTags, addTag };
}

export type TagList = ReturnType<typeof useTagList>;
