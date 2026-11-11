import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { deleteTask } from '../api/tasks';
import type { Task } from '../api/types';
import { useInstantUpdate } from '../lib/useInstantUpdate';
import { registerFlush } from './pendingFlush';
import { indexByCreatedAt, isTempId, reinsertAt, removeById } from './taskState';

/** How long Undo is offered. After this the deletion is final: no trash, no other recovery. */
export const UNDO_WINDOW_MS = 5000;

interface PendingStore {
  commit: (change: (list: Task[]) => Task[]) => void;
  listRef: RefObject<Task[]>;
}

/** The one deletion inside its window: how to send it now, or to drop it because of Undo. */
interface Active {
  task: Task;
  send: (keepalive: boolean) => Promise<void>;
  cancel: () => void;
}

/** What the save gives the hold: the abort signal and the call that starts the 15 s clock. */
interface SaveTiming {
  signal: AbortSignal;
  startClock: () => void;
}

type SetPending = (update: (current: Task | null) => Task | null) => void;

/**
 * Holds one DELETE for the window. Resolves when the server answered (or Undo dropped it), rejects
 * when the server refused. `active` is how a second delete, Undo or a page hide reaches it.
 */
function holdDelete(
  task: Task,
  timing: SaveTiming,
  active: RefObject<Active | null>,
  setPending: SetPending,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const end = () => {
      clearTimeout(timer);
      if (active.current === record) active.current = null;
      setPending((current) => (current === task ? null : current));
    };
    // The returned promise never rejects: the failure goes to the held promise via `reject`.
    const send = (keepalive: boolean) => {
      end();
      timing.startClock(); // the 15 s save timeout counts from the request, not from the undo hold
      return deleteTask(task.id, { signal: timing.signal, keepalive }).then(resolve, reject);
    };
    const timer = setTimeout(() => void send(false), UNDO_WINDOW_MS);
    const record: Active = {
      task,
      send,
      cancel: () => {
        end();
        resolve();
      },
    };
    active.current = record;
  });
}

/**
 * Delete with Undo. The row leaves the list at once; the DELETE is held for UNDO_WINDOW_MS and sent
 * when the window ends, when a second delete starts, or when the page is hidden or closed. Undo
 * inside the window means the server never hears of it. It composes useInstantUpdate, so a failed
 * DELETE puts the row back in its place and shows the shared failure message.
 */
export function usePendingDelete({ commit, listRef }: PendingStore) {
  const { run } = useInstantUpdate();
  const [pending, setPending] = useState<Task | null>(null);
  const active = useRef<Active | null>(null);

  // Back in its place by creation time against the list as it is now, not as it was.
  const restore = useCallback(
    (task: Task) => commit((list) => reinsertAt(list, task, indexByCreatedAt(list, task))),
    [commit],
  );

  const startDelete = useCallback(
    (id: string): Promise<boolean> => {
      const task = listRef.current?.find((row) => row.id === id);
      if (!task || isTempId(id)) return Promise.resolve(false);
      void active.current?.send(false); // a second delete makes the first one final
      return run({
        apply: () => {
          commit((list) => removeById(list, id));
          setPending(task);
        },
        save: (signal, startClock) => holdDelete(task, { signal, startClock }, active, setPending),
        clockStartsOnSend: true,
        rollback: () => restore(task),
      });
    },
    [run, commit, listRef, restore],
  );

  const undo = useCallback(() => {
    const record = active.current;
    if (!record) return;
    record.cancel();
    restore(record.task);
  }, [restore]);

  // Closing the page or leaving the list during the window makes the deletion final (ASM-026).
  useEffect(() => {
    const flush = () => void active.current?.send(true);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  // Log out sends the held DELETE now and waits for it before ending the session.
  useEffect(() => registerFlush(() => active.current?.send(false) ?? Promise.resolve()), []);

  return { startDelete, undo, deletePending: pending !== null };
}
