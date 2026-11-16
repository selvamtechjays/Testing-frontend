// tier: unit
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteTask, listTasks, updateTask } from '../api/tasks';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import { FailureNoticeProvider } from '../lib/FailureNoticeContext';
import { TasksProvider } from './TasksProvider';
import { UNDO_WINDOW_MS } from './usePendingDelete';
import { useTasks } from './useTasks';

// Unit tier: the network layer is replaced so the order in which answers land is under test control.
vi.mock('../api/tasks', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

const LONG_AGO = '2000-01-01';
const late = buildTask({
  id: 'late',
  title: 'Late',
  dueDate: LONG_AGO,
  createdAt: '2026-11-07T12:00:00.000Z',
});
const plain = buildTask({ id: 'plain', title: 'Plain', createdAt: '2026-11-07T10:00:00.000Z' });

function wrapper({ children }: { children: ReactNode }) {
  return (
    <FailureNoticeProvider>
      <TasksProvider>{children}</TasksProvider>
    </FailureNoticeProvider>
  );
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type ListAnswer = { tasks: Task[]; overdueCount?: number };

/** The first list call answers at once; every later one waits to be released by the test. */
async function setup(first: ListAnswer) {
  const later: Array<Deferred<ListAnswer>> = [];
  vi.mocked(listTasks)
    .mockResolvedValueOnce(first)
    .mockImplementation(() => {
      const gate = deferred<ListAnswer>();
      later.push(gate);
      return gate.promise;
    });
  const hook = renderHook(() => useTasks(), { wrapper });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return { hook, later };
}

const ids = (hook: { result: { current: ReturnType<typeof useTasks> } }) =>
  hook.result.current.tasks.map((task) => task.id);
const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(deleteTask).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.mocked(listTasks).mockReset();
  vi.mocked(updateTask).mockReset();
});

describe('a delete held for Undo survives a list reload (BLT-delete-ghost-row)', () => {
  it('keeps the row gone through a filter change and still lowers the overdue count once the server has it', async () => {
    const { hook, later } = await setup({ tasks: [late, plain], overdueCount: 1 });
    expect(hook.result.current.overdueCount).toBe(1);
    await act(async () => {
      void hook.result.current.startDelete('late');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ids(hook)).toEqual(['plain']);

    // Within the window a filter changes; the server has not heard of the delete, so it lists the row.
    act(() => hook.result.current.setFilter('priority', 'medium'));
    await settle();
    later[0].resolve({ tasks: [late, plain], overdueCount: 1 });
    await settle();
    expect(ids(hook)).toEqual(['plain']);
    expect(hook.result.current.overdueCount).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    });
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(ids(hook)).toEqual(['plain']);
    expect(hook.result.current.overdueCount).toBe(0);
  });

  it('puts an undone row back through a reload and leaves the count alone', async () => {
    const { hook, later } = await setup({ tasks: [late, plain], overdueCount: 1 });
    await act(async () => {
      void hook.result.current.startDelete('late');
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => hook.result.current.undoDelete());
    await settle();
    expect(ids(hook)).toEqual(['late', 'plain']);
    act(() => hook.result.current.setFilter('priority', 'medium'));
    await settle();
    later[0].resolve({ tasks: [late, plain], overdueCount: 1 });
    await settle();
    expect(ids(hook)).toEqual(['late', 'plain']);
    expect(hook.result.current.overdueCount).toBe(1);
    expect(deleteTask).not.toHaveBeenCalled();
  });
});

describe('a finished delete is not undone by a response sent before it (REV-CORR-3f71b556)', () => {
  it('keeps a deleted row gone when a search sent before its delete reached the server lands later', async () => {
    const other = buildTask({ id: 'other', title: 'Other', createdAt: '2026-11-07T09:00:00.000Z' });
    const { hook, later } = await setup({ tasks: [late, plain, other], overdueCount: 1 });
    await act(async () => {
      void hook.result.current.startDelete('late');
      await vi.advanceTimersByTimeAsync(0);
    });
    // A search goes out while the server still has the first task.
    act(() => hook.result.current.setFilter('priority', 'medium'));
    await settle();
    // Deleting a second task finalises the first at once.
    await act(async () => {
      void hook.result.current.startDelete('plain');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(hook.result.current.overdueCount).toBe(0);
    later[0].resolve({ tasks: [late, plain, other], overdueCount: 1 });
    await settle();
    expect(ids(hook)).toEqual(['other']);
    expect(hook.result.current.overdueCount).toBe(0);
  });

  it('lets a request sent after the delete finished carry on as usual', async () => {
    const { hook, later } = await setup({ tasks: [late, plain], overdueCount: 1 });
    await act(async () => {
      void hook.result.current.startDelete('late');
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    });
    expect(deleteTask).toHaveBeenCalledTimes(1);
    expect(ids(hook)).toEqual(['plain']);
    // Another change settles after the delete, so every request from here on is sent after it.
    vi.mocked(updateTask).mockResolvedValue({ task: { ...plain, dueDate: LONG_AGO } });
    await act(async () => {
      void hook.result.current.changeDueDate('plain', LONG_AGO);
      await vi.advanceTimersByTimeAsync(0);
    });
    const plainEdited = { ...plain, dueDate: LONG_AGO };

    // A response to a request sent after the delete is trusted: the row it lists is shown.
    act(() => hook.result.current.setFilter('priority', 'medium'));
    await settle();
    later[0].resolve({ tasks: [late, plainEdited], overdueCount: 2 });
    await settle();
    expect(ids(hook)).toEqual(['late', 'plain']);

    // The delete is forgotten by then, so the next request's response is not filtered either.
    act(() => hook.result.current.setFilter('priority', 'high'));
    await settle();
    later[1].resolve({ tasks: [late, plainEdited], overdueCount: 2 });
    await settle();
    expect(ids(hook)).toEqual(['late', 'plain']);
  });
});

describe('a list response never undoes a confirmed change to the overdue count (REV-CORR-117f6275)', () => {
  function moveToYesterday(hook: Awaited<ReturnType<typeof setup>>['hook']) {
    const patch = deferred<{ task: Task }>();
    vi.mocked(updateTask).mockReturnValue(patch.promise as ReturnType<typeof updateTask>);
    act(() => void hook.result.current.changeDueDate('plain', LONG_AGO));
    return patch;
  }

  it('keeps the confirmed +1 when an older response lands after the change settled', async () => {
    const { hook, later } = await setup({ tasks: [plain], overdueCount: 0 });
    // The list request goes out first, then the change; the change settles before the answer lands.
    act(() => hook.result.current.setFilter('priority', 'medium'));
    await settle();
    const patch = moveToYesterday(hook);
    await act(async () => {
      patch.resolve({ task: { ...plain, dueDate: LONG_AGO } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hook.result.current.overdueCount).toBe(1);
    later[0].resolve({ tasks: [plain], overdueCount: 0 });
    await settle();
    expect(hook.result.current.overdueCount).toBe(1);
  });

  it('does not add the change twice when a newer response lands while it is still saving', async () => {
    const { hook, later } = await setup({ tasks: [plain], overdueCount: 0 });
    const patch = moveToYesterday(hook);
    act(() => hook.result.current.setFilter('priority', 'medium'));
    await settle();
    // The server had already applied the change, so its count says 1 while the save is in flight.
    later[0].resolve({ tasks: [{ ...plain, dueDate: LONG_AGO }], overdueCount: 1 });
    await settle();
    await act(async () => {
      patch.resolve({ task: { ...plain, dueDate: LONG_AGO } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hook.result.current.overdueCount).toBe(1);
  });

  it('takes the response count again once nothing has changed since its request', async () => {
    const { hook, later } = await setup({ tasks: [plain], overdueCount: 0 });
    act(() => hook.result.current.setFilter('priority', 'medium'));
    await settle();
    later[0].resolve({ tasks: [plain], overdueCount: 3 });
    await settle();
    expect(hook.result.current.overdueCount).toBe(3);
  });
});

describe('sort alone narrows nothing (BLT-sort-not-narrowing)', () => {
  it('shows the empty state, not the no-match state, for a sort with no tasks and no search', async () => {
    const { hook, later } = await setup({ tasks: [], overdueCount: 0 });
    act(() => hook.result.current.setFilter('sort', 'due'));
    await settle();
    later[0].resolve({ tasks: [], overdueCount: 0 });
    await settle();
    expect(hook.result.current.status).toBe('empty');
    expect(hook.result.current.filtersApplied).toBe(false);
  });

  it('still says no match when a narrowing filter is on', async () => {
    const { hook, later } = await setup({ tasks: [], overdueCount: 0 });
    act(() => hook.result.current.setFilter('status', 'completed'));
    await settle();
    later[0].resolve({ tasks: [], overdueCount: 0 });
    await settle();
    expect(hook.result.current.status).toBe('noMatch');
    expect(hook.result.current.filtersApplied).toBe(true);
  });
});

describe('today follows the calendar while the tab stays open (BLT-stale-today)', () => {
  it('moves to the new day when the tab becomes visible or the window is focused again', async () => {
    vi.setSystemTime(new Date(2026, 10, 16, 23, 0));
    const { hook } = await setup({ tasks: [plain], overdueCount: 0 });
    expect(hook.result.current.today).toBe('2026-11-16');
    vi.setSystemTime(new Date(2026, 10, 17, 8, 0));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(hook.result.current.today).toBe('2026-11-17');
    vi.setSystemTime(new Date(2026, 10, 18, 8, 0));
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(hook.result.current.today).toBe('2026-11-18');
  });
  it('reloads the list when the new day is found, so the overdue count follows it (REV-CORR-50b77536)', async () => {
    vi.setSystemTime(new Date(2026, 10, 16, 23, 0));
    const { hook, later } = await setup({ tasks: [plain], overdueCount: 0 });
    expect(listTasks).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(2026, 10, 17, 8, 0));
    act(() => void window.dispatchEvent(new Event('focus')));
    await settle();
    expect(listTasks).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listTasks).mock.calls[1]?.[0]?.today).toBe('2026-11-17');
    later[0]?.resolve({ tasks: [plain], overdueCount: 2 });
    await settle();
    expect(hook.result.current.overdueCount).toBe(2);
  });

  it('does not reload when the date is still the same (REV-CORR-50b77536)', async () => {
    vi.setSystemTime(new Date(2026, 10, 16, 9, 0));
    await setup({ tasks: [plain], overdueCount: 0 });
    vi.setSystemTime(new Date(2026, 10, 16, 18, 0));
    act(() => void window.dispatchEvent(new Event('focus')));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await settle();
    expect(listTasks).toHaveBeenCalledTimes(1);
  });
});
