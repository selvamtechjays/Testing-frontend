import { useCallback } from 'react';
import { ApiError, isSessionEnd } from '../api/client';
import { copy } from '../copy';
import { useFailureNotice } from './FailureNoticeContext';

/** A save that has not answered after this long is treated like any other failed save (AC-8). */
export const SAVE_TIMEOUT_MS = 15_000;

export interface InstantUpdate {
  /** Shows the change on screen at once. Runs synchronously, before any await. */
  apply: () => void;
  /**
   * Stores the change. Receives a signal that aborts after SAVE_TIMEOUT_MS, counted from the
   * call, or from `startClock` when `clockStartsOnSend` is set.
   */
  save: (signal: AbortSignal, startClock: () => void) => Promise<unknown>;
  /** The save holds its request back (the undo window): the timeout starts at `startClock`. */
  clockStartsOnSend?: boolean;
  /** Restores only what `apply` changed. Runs on any failed save. */
  rollback: () => void;
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new ApiError(0, 'TIMEOUT', '')), { once: true });
  });
}

/** Runs the save against a timeout, so a save that ignores its signal still ends. */
async function saveWithTimeout(
  save: InstantUpdate['save'],
  clockStartsOnSend: boolean,
): Promise<void> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startClock = () => {
    timer ??= setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
  };
  if (!clockStartsOnSend) startClock();
  try {
    await Promise.race([save(controller.signal, startClock), rejectOnAbort(controller.signal)]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The one mechanism for add, tick, untick, edit and delete: show the change, save in the
 * background, undo it and say so if the save fails. Exposes no loading or pending state (BR-1).
 */
export function useInstantUpdate() {
  const { show } = useFailureNotice();

  const run = useCallback(
    async ({
      apply,
      save,
      rollback,
      clockStartsOnSend = false,
    }: InstantUpdate): Promise<boolean> => {
      try {
        apply();
        await saveWithTimeout(save, clockStartsOnSend);
        return true;
      } catch (error) {
        rollback();
        // A 401 is routed by the global handler; showing "could not save" as well would mislead.
        if (!isSessionEnd(error)) show(copy.saveFailed);
        return false;
      }
    },
    [show],
  );

  return { run };
}
