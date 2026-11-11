// tier: unit
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { deleteTask, listTasks } from '../api/tasks';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { TasksProvider } from './TasksProvider';
import { SAVE_TIMEOUT_MS } from '../lib/useInstantUpdate';
import { UNDO_WINDOW_MS } from './usePendingDelete';
import { useTasks } from './useTasks';

// Unit tier: the network layer is replaced so the 5 second window can run on fake timers.
vi.mock('../api/tasks', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

const SAVE_FAILED = 'Could not save your change. It was undone.';
const at = (hour: number) => `2026-11-07T${String(hour).padStart(2, '0')}:00:00.000Z`;
const a = buildTask({ id: 'a', title: 'Alpha', createdAt: at(12) });
const b = buildTask({ id: 'b', title: 'Bravo', createdAt: at(10) });
const c = buildTask({ id: 'c', title: 'Charlie', status: 'completed', createdAt: at(8) });

function wrapper({ children }: { children: ReactNode }) {
  return (
    <FailureNoticeProvider>
      <TasksProvider>{children}</TasksProvider>
    </FailureNoticeProvider>
  );
}

async function setup(tasks: Task[] = [a, b, c]) {
  vi.mocked(listTasks).mockResolvedValue({ tasks });
  const hook = renderHook(() => ({ list: useTasks(), notice: useFailureNotice() }), { wrapper });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return hook;
}

type Hook = Awaited<ReturnType<typeof setup>>;
const ids = (hook: Hook) => hook.result.current.list.tasks.map((t) => t.id);
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const del = (hook: Hook, id: string) =>
  act(async () => {
    void hook.result.current.list.startDelete(id);
    await vi.advanceTimersByTimeAsync(0);
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(deleteTask).mockResolvedValue(undefined);
});

afterEach(() => {
  // Unmounting flushes a pending delete, so do it before the mocks are cleared.
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('usePendingDelete window', () => {
  it('removes the row at once and offers Undo, without calling the server yet (AC-1 BR-1 TS-1)', async () => {
    const hook = await setup();
    await del(hook, 'b');
    expect(ids(hook)).toEqual(['a', 'c']);
    expect(hook.result.current.list.deletePending).toBe(true);
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it('sends no request before 5000 ms and exactly one at 5000 ms (AC-3 BR-3 TS-3)', async () => {
    const hook = await setup();
    await del(hook, 'b');
    await advance(UNDO_WINDOW_MS - 1);
    expect(deleteTask).not.toHaveBeenCalled();
    await advance(1);
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith('b', expect.objectContaining({ keepalive: false }));
    await advance(20_000);
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(ids(hook)).toEqual(['a', 'c']);
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('withdraws Undo once the window ends, so a late undo restores nothing (AC-5 BR-3 TS-6 TS-7)', async () => {
    const hook = await setup();
    await del(hook, 'b');
    await advance(UNDO_WINDOW_MS - 1);
    expect(hook.result.current.list.deletePending).toBe(true);
    await advance(1);
    expect(hook.result.current.list.deletePending).toBe(false);
    act(() => hook.result.current.list.undoDelete());
    expect(ids(hook)).toEqual(['a', 'c']);
  });
});

describe('usePendingDelete undo', () => {
  it('puts the task back in its place on Undo and never calls the server (AC-2 BR-2 TS-2)', async () => {
    const hook = await setup();
    await del(hook, 'b');
    await advance(3000);
    act(() => hook.result.current.list.undoDelete());
    expect(ids(hook)).toEqual(['a', 'b', 'c']);
    expect(hook.result.current.list.deletePending).toBe(false);
    await advance(30_000);
    expect(deleteTask).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores a Completed task still Completed, with the same title and time (AC-4 BR-1 BR-2 TS-4)', async () => {
    const hook = await setup();
    await del(hook, 'c');
    act(() => hook.result.current.list.undoDelete());
    expect(hook.result.current.list.tasks[2]).toEqual(c);
  });

  it('restores an emoji and accented title exactly (AC-2 TS-5)', async () => {
    const odd = buildTask({ id: 'e', title: 'Plan 🚀 café 計画', createdAt: at(11) });
    const hook = await setup([a, odd, c]);
    await del(hook, 'e');
    act(() => hook.result.current.list.undoDelete());
    expect(hook.result.current.list.tasks[1].title).toBe('Plan 🚀 café 計画');
  });

  it('shows the empty list for a deleted only task and Undo brings it back (AC-1 AC-2 TS-11)', async () => {
    const hook = await setup([a]);
    await del(hook, 'a');
    expect(hook.result.current.list.status).toBe('empty');
    act(() => hook.result.current.list.undoDelete());
    expect(hook.result.current.list.status).toBe('populated');
    expect(ids(hook)).toEqual(['a']);
  });

  it('places the task by creation time against the list as it is now (AC-2)', async () => {
    const hook = await setup();
    await del(hook, 'b');
    await del(hook, 'a'); // a second delete: b is final, a is the one on offer
    expect(ids(hook)).toEqual(['c']);
    await del(hook, 'c');
    act(() => hook.result.current.list.undoDelete());
    expect(ids(hook)).toEqual(['c']);
  });
});

describe('usePendingDelete failures', () => {
  it.each([[503], [404], [500], [0]])(
    'on a failed delete (%i) puts the row back in its place and shows the shared message (AC-8 BR-4 TS-9)',
    async (status) => {
      vi.mocked(deleteTask).mockRejectedValue(new ApiError(status, 'X', ''));
      const hook = await setup();
      await del(hook, 'b');
      await advance(UNDO_WINDOW_MS);
      expect(ids(hook)).toEqual(['a', 'b', 'c']);
      expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
      expect(hook.result.current.list.deletePending).toBe(false);
    },
  );

  it('on a 401 puts the row back and shows no failure message (DEC-075)', async () => {
    vi.mocked(deleteTask).mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', ''));
    const hook = await setup();
    await del(hook, 'b');
    await advance(UNDO_WINDOW_MS);
    expect(ids(hook)).toEqual(['a', 'b', 'c']);
    expect(hook.result.current.notice.message).toBeNull();
  });
});

describe('usePendingDelete save timeout', () => {
  it('gives the DELETE the full save timeout after the undo hold, not before it (AC-8 BR-4)', async () => {
    vi.mocked(deleteTask).mockImplementation(() => new Promise(() => {})); // never answers
    const hook = await setup();
    await del(hook, 'b');
    await advance(UNDO_WINDOW_MS); // the DELETE is sent here
    expect(deleteTask).toHaveBeenCalledTimes(1);
    await advance(SAVE_TIMEOUT_MS - 1); // 19999 ms after the click, 14999 ms after the send
    expect(ids(hook)).toEqual(['a', 'c']);
    expect(hook.result.current.notice.message).toBeNull();
    await advance(1);
    expect(ids(hook)).toEqual(['a', 'b', 'c']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('counts a flushed DELETE from the moment it is sent (second delete)', async () => {
    vi.mocked(deleteTask).mockImplementation(() => new Promise(() => {}));
    const hook = await setup();
    await del(hook, 'b');
    await advance(UNDO_WINDOW_MS - 1000);
    await del(hook, 'a'); // sends the first DELETE now
    await advance(SAVE_TIMEOUT_MS - 1);
    expect(hook.result.current.notice.message).toBeNull();
    await advance(1);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });
});

describe('usePendingDelete flush rules', () => {
  it('a second delete makes the first final at once and Undo restores only the second (OQ-TASK-03)', async () => {
    const hook = await setup();
    await del(hook, 'b');
    await del(hook, 'a');
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith('b', expect.objectContaining({ keepalive: false }));
    expect(ids(hook)).toEqual(['c']);
    act(() => hook.result.current.list.undoDelete());
    expect(ids(hook)).toEqual(['a', 'c']);
    await advance(30_000);
    expect(deleteTask).toHaveBeenCalledTimes(1);
  });

  it('a first delete that fails when flushed comes back in its place with the message (AC-8)', async () => {
    vi.mocked(deleteTask).mockRejectedValueOnce(new ApiError(500, 'INTERNAL', ''));
    const hook = await setup();
    await del(hook, 'b');
    await del(hook, 'a');
    expect(ids(hook)).toEqual(['b', 'c']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('flushes a pending delete with keepalive when the page is hidden (AC-7 BR-3 TS-10)', async () => {
    const hook = await setup();
    await del(hook, 'b');
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith('b', expect.objectContaining({ keepalive: true }));
    await advance(30_000);
    expect(deleteTask).toHaveBeenCalledTimes(1);
  });

  it('flushes with keepalive when the list unmounts, leaving no timer or listener behind (AC-7)', async () => {
    const hook = await setup();
    await del(hook, 'b');
    hook.unmount();
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(deleteTask).toHaveBeenCalledWith('b', expect.objectContaining({ keepalive: true }));
    await vi.advanceTimersByTimeAsync(0); // let the answered save clear its own timeout
    expect(vi.getTimerCount()).toBe(0);
    window.dispatchEvent(new Event('pagehide'));
    expect(deleteTask).toHaveBeenCalledTimes(1);
  });

  it('does nothing on pagehide or unmount when nothing is pending (AC-7)', async () => {
    const hook = await setup();
    window.dispatchEvent(new Event('pagehide'));
    hook.unmount();
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it('ignores an unknown id and an unsaved temporary row (R-3)', async () => {
    const temp = buildTask({ id: 'temp-1', title: 'Unsaved' });
    const hook = await setup([temp, a]);
    let results: boolean[] = [];
    await act(async () => {
      results = [
        await hook.result.current.list.startDelete('nope'),
        await hook.result.current.list.startDelete('temp-1'),
      ];
    });
    expect(results).toEqual([false, false]);
    expect(ids(hook)).toEqual(['temp-1', 'a']);
    expect(hook.result.current.list.deletePending).toBe(false);
  });
});
