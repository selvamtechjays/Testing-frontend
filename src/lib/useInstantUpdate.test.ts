// tier: unit
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { Task } from '../api/types';
import { copy } from '../copy';
import { FailureNoticeProvider, useFailureNotice } from './FailureNoticeContext';
import { insertTemp, patchField, reinsertAt, removeById } from '../tasks/taskState';
import { buildTask } from '../test/builders/task';
import { SAVE_TIMEOUT_MS, useInstantUpdate } from './useInstantUpdate';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(FailureNoticeProvider, null, children);
}

function setup() {
  return renderHook(() => ({ update: useInstantUpdate(), notice: useFailureNotice() }), {
    wrapper,
  });
}

/** A tiny list holder standing in for the screen state a caller owns. */
function listHolder(initial: Task[]) {
  const holder = { list: initial };
  return holder;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useInstantUpdate success path', () => {
  it('applies the change before the save has answered, with no pending state (AC-1 BR-1 TS-1)', async () => {
    const { result } = setup();
    const order: string[] = [];
    let finish: (value: unknown) => void = () => {};
    const save = vi.fn(() => {
      order.push('save');
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    let outcome: Promise<boolean> | undefined;
    act(() => {
      outcome = result.current.update.run({
        apply: () => order.push('apply'),
        save,
        rollback: () => order.push('rollback'),
      });
    });
    expect(order).toEqual(['apply', 'save']);
    expect(Object.keys(result.current.update)).toEqual(['run']);
    await act(async () => {
      finish({});
      await outcome;
    });
  });

  it('shows nothing and keeps the change when the save succeeds (AC-2 BR-2 TS-3)', async () => {
    const { result } = setup();
    const rollback = vi.fn();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.update.run({
        apply: () => {},
        save: () => Promise.resolve({ task: buildTask() }),
        rollback,
      });
    });
    expect(ok).toBe(true);
    expect(rollback).not.toHaveBeenCalled();
    expect(result.current.notice.message).toBeNull();
  });

  it('never persists anything to local storage (AC-7)', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = setup();
    await act(async () => {
      await result.current.update.run({
        apply: () => {},
        save: () => Promise.reject(new ApiError(500, 'INTERNAL', '')),
        rollback: () => {},
      });
    });
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe('useInstantUpdate failure path', () => {
  it.each([
    ['add', 'AC-3'],
    ['tick', 'AC-4'],
    ['edit', 'AC-5'],
    ['delete', 'AC-6'],
  ])('rolls back a failed %s and tells the user (%s BR-3 TS-4 TS-5 TS-6 TS-7)', async (shape) => {
    const original: Task[] = [
      buildTask({ id: 'x', title: 'X' }),
      buildTask({ id: 'y', title: 'Y' }),
    ];
    const holder = listHolder(original);
    const temp = buildTask({ id: 'temp-1', title: 'new' });
    let removedAt = -1;
    const steps: Record<string, { apply: () => void; rollback: () => void }> = {
      add: {
        apply: () => (holder.list = insertTemp(holder.list, temp)),
        rollback: () => (holder.list = removeById(holder.list, temp.id)),
      },
      tick: {
        apply: () => (holder.list = patchField(holder.list, 'x', 'status', 'completed')),
        rollback: () => (holder.list = patchField(holder.list, 'x', 'status', 'pending')),
      },
      edit: {
        apply: () => (holder.list = patchField(holder.list, 'x', 'title', 'Edited')),
        rollback: () => (holder.list = patchField(holder.list, 'x', 'title', 'X')),
      },
      delete: {
        apply: () => {
          removedAt = holder.list.findIndex((task) => task.id === 'x');
          holder.list = removeById(holder.list, 'x');
        },
        rollback: () => {
          holder.list = reinsertAt(holder.list, original[removedAt], removedAt);
        },
      },
    };
    const { result } = setup();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.update.run({
        ...steps[shape],
        save: () => Promise.reject(new ApiError(500, 'INTERNAL', 'boom')),
      });
    });
    expect(ok).toBe(false);
    expect(holder.list).toEqual(original);
    expect(result.current.notice.message).toBe(copy.saveFailed);
  });

  it.each([
    [0, 'NETWORK'],
    [400, 'VALIDATION'],
    [404, 'NOT_FOUND'],
    [500, 'INTERNAL'],
    [503, 'SERVICE_UNAVAILABLE'],
  ])('treats status %i like any other failed save (AC-8 TS-5)', async (status, code) => {
    const { result } = setup();
    const rollback = vi.fn();
    await act(async () => {
      await result.current.update.run({
        apply: () => {},
        save: () => Promise.reject(new ApiError(status, code, '')),
        rollback,
      });
    });
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(result.current.notice.message).toBe(copy.saveFailed);
  });

  it('rolls back on a 401 but leaves the message to the global handler (BR-3)', async () => {
    const { result } = setup();
    const rollback = vi.fn();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.update.run({
        apply: () => {},
        save: () => Promise.reject(new ApiError(401, 'UNAUTHENTICATED', '')),
        rollback,
      });
    });
    expect(ok).toBe(false);
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(result.current.notice.message).toBeNull();
  });

  it('rolls back and shows the failure notice on a 401 that is not UNAUTHENTICATED (CR-7)', async () => {
    const { result } = setup();
    const rollback = vi.fn();
    await act(async () => {
      await result.current.update.run({
        apply: () => {},
        save: () => Promise.reject(new ApiError(401, 'SOMETHING_ELSE', '')),
        rollback,
      });
    });
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(result.current.notice.message).toBe(copy.saveFailed);
  });

  it('treats a non-error rejection as a failed save and never rejects itself (BR-3)', async () => {
    const { result } = setup();
    const rollback = vi.fn();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.update.run({
        apply: () => {},
        save: () => Promise.reject('plain string'),
        rollback,
      });
    });
    expect(ok).toBe(false);
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(result.current.notice.message).toBe(copy.saveFailed);
  });

  it('undoes a change whose apply throws and still resolves false (BR-3)', async () => {
    const { result } = setup();
    const rollback = vi.fn();
    const save = vi.fn(() => Promise.resolve({}));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.update.run({
        apply: () => {
          throw new Error('render failed');
        },
        save,
        rollback,
      });
    });
    expect(ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it('replaces a visible message with the next failure, in one region (BR-3)', async () => {
    const { result } = setup();
    await act(async () => {
      result.current.notice.show('older message');
      await result.current.update.run({
        apply: () => {},
        save: () => Promise.reject(new ApiError(500, 'INTERNAL', '')),
        rollback: () => {},
      });
    });
    expect(result.current.notice.message).toBe(copy.saveFailed);
  });
});

describe('useInstantUpdate timeout', () => {
  it('aborts after 15 seconds and treats it as a failed save, even if save ignores the signal (AC-8 TS-5)', async () => {
    vi.useFakeTimers();
    const { result } = setup();
    const rollback = vi.fn();
    let seen: AbortSignal | undefined;
    let outcome: Promise<boolean> | undefined;
    act(() => {
      outcome = result.current.update.run({
        apply: () => {},
        save: (signal) => {
          seen = signal;
          return new Promise(() => {});
        },
        rollback,
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS - 1);
    });
    expect(rollback).not.toHaveBeenCalled();
    expect(seen?.aborted).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await outcome;
    });
    expect(seen?.aborted).toBe(true);
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(result.current.notice.message).toBe(copy.saveFailed);
  });

  it('clears its timer once the save answers, so nothing is aborted later (AC-2)', async () => {
    vi.useFakeTimers();
    const { result } = setup();
    let seen: AbortSignal | undefined;
    await act(async () => {
      await result.current.update.run({
        apply: () => {},
        save: (signal) => {
          seen = signal;
          return Promise.resolve({});
        },
        rollback: () => {},
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS * 2);
    });
    expect(seen?.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useInstantUpdate interleaved changes', () => {
  it('rolls back only its own field when another change succeeded meanwhile (R-1 AC-4 AC-5)', async () => {
    const holder = listHolder([buildTask({ id: 'x', title: 'X', status: 'pending' })]);
    const { result } = setup();
    let failTick: (error: unknown) => void = () => {};
    let tick: Promise<boolean> | undefined;
    act(() => {
      tick = result.current.update.run({
        apply: () => (holder.list = patchField(holder.list, 'x', 'status', 'completed')),
        save: () =>
          new Promise((_, reject) => {
            failTick = reject;
          }),
        rollback: () => (holder.list = patchField(holder.list, 'x', 'status', 'pending')),
      });
    });
    await act(async () => {
      await result.current.update.run({
        apply: () => (holder.list = patchField(holder.list, 'x', 'title', 'Edited')),
        save: () => Promise.resolve({}),
        rollback: () => (holder.list = patchField(holder.list, 'x', 'title', 'X')),
      });
    });
    await act(async () => {
      failTick(new ApiError(500, 'INTERNAL', ''));
      await tick;
    });
    expect(holder.list[0]).toMatchObject({ title: 'Edited', status: 'pending' });
    expect(result.current.notice.message).toBe(copy.saveFailed);
  });
});
