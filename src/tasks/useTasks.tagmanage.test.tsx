// tier: integration
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tag, Task } from '../api/types';
import { DEFAULT_FILTERS } from '../api/types';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { buildTask } from '../test/builders/task';
import { server } from '../test/mocks/server';
import { serverErrorBody } from '../test/mocks/tasks';
import { buildTag, listTasksWithTags, tagsManaging, TAG_MESSAGES } from '../test/mocks/tags';
import { SAVE_TIMEOUT_MS } from '../lib/useInstantUpdate';
import { saveFilters } from './listFilters';
import { TasksProvider } from './TasksProvider';
import { useTasks } from './useTasks';

const SAVE_FAILED = 'Could not save your change. It was undone.';
const USER = 'u1';
const HOME_ID = 'a1a1a1a1a1a1a1a1a1a1a1a1';
const WORK_ID = 'b2b2b2b2b2b2b2b2b2b2b2b2';

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <FailureNoticeProvider>
      <TasksProvider userId={USER}>{children}</TasksProvider>
    </FailureNoticeProvider>
  );
}

const tagOf = ({ id, name, colour }: Tag) => ({ id, name, colour });

function world() {
  const home = buildTag({ id: HOME_ID, name: 'Home', colour: 'green' });
  const work = buildTag({ id: WORK_ID, name: 'Work', colour: 'blue' });
  const tasks: Task[] = [
    buildTask({ id: 'a', title: 'Alpha', tags: [tagOf(home), tagOf(work)] }),
    buildTask({ id: 'b', title: 'Bravo', tags: [tagOf(work)] }),
    buildTask({ id: 'c', title: 'Charlie' }),
  ];
  return { tags: [home, work], tasks };
}

async function setup(w = world()) {
  server.use(...tagsManaging(w.tags, w.tasks), listTasksWithTags(w.tasks, w.tags));
  const hook = renderHook(() => ({ list: useTasks(), notice: useFailureNotice() }), { wrapper });
  await waitFor(() => expect(hook.result.current.list.status).not.toBe('loading'));
  await waitFor(() => expect(hook.result.current.list.tagsStatus).toBe('ready'));
  return { hook, w };
}

type Hook = Awaited<ReturnType<typeof setup>>['hook'];
const chips = (hook: Hook, id: string) =>
  hook.result.current.list.tasks.find((t) => t.id === id)?.tags.map((t) => `${t.name}:${t.colour}`);
const listNames = (hook: Hook) => hook.result.current.list.tags.map((t) => t.name);

/** The fresh count for one tag, read inside act so the state it updates is flushed. */
async function countOf(hook: Hook, id: string): Promise<number | null> {
  let count: number | null = -1;
  await act(async () => {
    count = await hook.result.current.list.freshTaskCount(id);
  });
  return count;
}

/** A PATCH or DELETE on /api/tags/:id held open until the test lets it answer. */
function held(method: 'patch' | 'delete', answer: () => Response) {
  const gates: Array<() => void> = [];
  const handler = method === 'patch' ? http.patch : http.delete;
  server.use(
    handler('/api/tags/:id', async () => {
      await new Promise<void>((resolve) => gates.push(resolve));
      return answer();
    }),
  );
  return gates;
}

describe('useTasks updateTag (FEAT-TAG-02 AC-2 AC-3 AC-9 AC-18 AC-19)', () => {
  it('changes nothing before the server answers, then the list and every row together, re-sorted (TAG02 AC-2 BR-4 BR-5)', async () => {
    const { hook } = await setup();
    const gates = held('patch', () =>
      HttpResponse.json({ tag: buildTag({ id: WORK_ID, name: 'Alpha tag', colour: 'blue' }) }),
    );
    let done: Promise<unknown> | undefined;
    act(() => {
      done = hook.result.current.list.updateTag(WORK_ID, { name: 'Alpha tag' });
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(listNames(hook)).toEqual(['Home', 'Work']);
    expect(chips(hook, 'a')).toEqual(['Home:green', 'Work:blue']);
    await act(async () => {
      gates[0]();
      expect(await done).toEqual({ ok: true });
    });
    expect(listNames(hook)).toEqual(['Alpha tag', 'Home']);
    expect(chips(hook, 'a')).toEqual(['Alpha tag:blue', 'Home:green']);
    expect(chips(hook, 'b')).toEqual(['Alpha tag:blue']);
  });

  it('recolours the tag in the list and on every chip of it together (TAG02 AC-3 BR-5)', async () => {
    const { hook } = await setup();
    await act(async () => {
      expect(await hook.result.current.list.updateTag(WORK_ID, { colour: 'purple' })).toEqual({
        ok: true,
      });
    });
    expect(hook.result.current.list.tags.find((t) => t.id === WORK_ID)?.colour).toBe('purple');
    expect(chips(hook, 'a')).toEqual(['Home:green', 'Work:purple']);
    expect(chips(hook, 'b')).toEqual(['Work:purple']);
  });

  it('a rename survives a later rollback on a row: the confirmed copy was renamed too (TAG02 AC-2)', async () => {
    const { hook, w } = await setup();
    await act(async () => {
      await hook.result.current.list.updateTag(WORK_ID, { name: 'Office' });
    });
    server.use(
      http.patch('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status: 500 })),
    );
    await act(async () => {
      await hook.result.current.list.changeTags('c', [HOME_ID]);
    });
    expect(chips(hook, 'c')).toEqual([]);
    await act(async () => {
      await hook.result.current.list.changeTags('b', []);
    });
    expect(chips(hook, 'b')).toEqual(['Office:blue']);
    expect(w.tags.map((t) => t.name)).toContain('Office');
  });

  it('a refused rename returns the server message and changes nothing, with no notice (TAG02 AC-9)', async () => {
    const { hook } = await setup();
    let result: unknown;
    await act(async () => {
      result = await hook.result.current.list.updateTag(HOME_ID, { name: 'work' });
    });
    expect(result).toEqual({ ok: false, message: TAG_MESSAGES.duplicate });
    expect(listNames(hook)).toEqual(['Home', 'Work']);
    expect(chips(hook, 'a')).toEqual(['Home:green', 'Work:blue']);
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('returns the empty and over-long name messages the same way (TAG02 AC-10)', async () => {
    const { hook } = await setup();
    const messages: unknown[] = [];
    await act(async () => {
      messages.push(await hook.result.current.list.updateTag(HOME_ID, { name: '' }));
      messages.push(await hook.result.current.list.updateTag(HOME_ID, { name: 'x'.repeat(31) }));
    });
    expect(messages).toEqual([
      { ok: false, message: TAG_MESSAGES.empty },
      { ok: false, message: TAG_MESSAGES.tooLong },
    ]);
  });

  it('allows a rename that only changes the letter case of its own name (TAG02 AC-16)', async () => {
    const { hook } = await setup();
    await act(async () => {
      expect(await hook.result.current.list.updateTag(WORK_ID, { name: 'work' })).toEqual({
        ok: true,
      });
    });
    expect(chips(hook, 'b')).toEqual(['work:blue']);
  });

  it('a tag deleted in another tab is refused: notFound, the failure notice and a quiet refresh (TAG02 AC-18 BR-11)', async () => {
    const { hook, w } = await setup();
    w.tags.splice(0, 1);
    let result: unknown;
    await act(async () => {
      result = await hook.result.current.list.updateTag(HOME_ID, { name: 'Houses' });
    });
    expect(result).toEqual({ ok: false, notFound: true });
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
    await waitFor(() => expect(listNames(hook)).toEqual(['Work']));
  });

  it('a failed request changes nothing and shows the failure notice (TAG02 AC-19)', async () => {
    const { hook } = await setup();
    server.use(
      http.patch('/api/tags/:id', () => HttpResponse.json(serverErrorBody, { status: 500 })),
    );
    let result: unknown;
    await act(async () => {
      result = await hook.result.current.list.updateTag(HOME_ID, { name: 'Houses' });
    });
    expect(result).toEqual({ ok: false });
    expect(listNames(hook)).toEqual(['Home', 'Work']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });
});

describe('useTasks deleteTag and freshTaskCount (FEAT-TAG-02 AC-4 AC-6 AC-8 AC-17 AC-18)', () => {
  it('removes nothing before the server confirms, then the tag from the list and every row (TAG02 AC-4 AC-8 BR-6)', async () => {
    const { hook } = await setup();
    const gates = held('delete', () => new HttpResponse(null, { status: 204 }));
    let done: Promise<unknown> | undefined;
    act(() => {
      done = hook.result.current.list.deleteTag(WORK_ID);
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(listNames(hook)).toEqual(['Home', 'Work']);
    expect(chips(hook, 'b')).toEqual(['Work:blue']);
    await act(async () => {
      gates[0]();
      expect(await done).toEqual({ ok: true });
    });
    expect(listNames(hook)).toEqual(['Home']);
    expect(chips(hook, 'a')).toEqual(['Home:green']);
    expect(chips(hook, 'b')).toEqual([]);
    expect(hook.result.current.list.tasks.map((t) => t.title)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  it('returns the filter to Any at once when the deleted tag was the Tag filter (TAG02 AC-6 BR-9)', async () => {
    saveFilters(USER, { ...DEFAULT_FILTERS, tag: WORK_ID });
    const { hook } = await setup();
    expect(hook.result.current.list.filters.tag).toBe(WORK_ID);
    await act(async () => {
      await hook.result.current.list.deleteTag(WORK_ID);
    });
    expect(hook.result.current.list.filters.tag).toBe('any');
    await waitFor(() => expect(hook.result.current.list.tasks).toHaveLength(3));
  });

  it('leaves the filter alone when another tag was deleted (TAG02 AC-6)', async () => {
    saveFilters(USER, { ...DEFAULT_FILTERS, tag: WORK_ID });
    const { hook } = await setup();
    await act(async () => {
      await hook.result.current.list.deleteTag(HOME_ID);
    });
    expect(hook.result.current.list.filters.tag).toBe(WORK_ID);
  });

  it('a delete that was refused as not found shows the notice, refreshes and reports notFound (TAG02 AC-18)', async () => {
    const { hook, w } = await setup();
    w.tags.splice(1, 1);
    let result: unknown;
    await act(async () => {
      result = await hook.result.current.list.deleteTag(WORK_ID);
    });
    expect(result).toEqual({ ok: false, notFound: true });
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
    await waitFor(() => expect(listNames(hook)).toEqual(['Home']));
  });

  it('a failed delete removes nothing and shows the failure notice (TAG02 AC-19)', async () => {
    const { hook } = await setup();
    server.use(
      http.delete('/api/tags/:id', () => HttpResponse.json(serverErrorBody, { status: 500 })),
    );
    let result: unknown;
    await act(async () => {
      result = await hook.result.current.list.deleteTag(WORK_ID);
    });
    expect(result).toEqual({ ok: false });
    expect(listNames(hook)).toEqual(['Home', 'Work']);
    expect(chips(hook, 'b')).toEqual(['Work:blue']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('reads the task count afresh from the server, so it is right after tasks were tagged or untagged (TAG02 AC-17 BR-7)', async () => {
    const { hook, w } = await setup();
    expect(await countOf(hook, WORK_ID)).toBe(2);
    w.tasks[2].tags = [tagOf(w.tags[1])];
    expect(await countOf(hook, WORK_ID)).toBe(3);
    w.tasks.splice(0, 1);
    expect(await countOf(hook, WORK_ID)).toBe(2);
  });

  it('returns null with the failure notice when the count could not be read (TAG02 AC-19)', async () => {
    const { hook } = await setup();
    server.use(http.get('/api/tags', () => HttpResponse.json(serverErrorBody, { status: 500 })));
    let count: number | null = 0;
    await act(async () => {
      count = await hook.result.current.list.freshTaskCount(WORK_ID);
    });
    expect(count).toBeNull();
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('returns null with the failure message, and the tag leaves the list, when it is already gone (TAG02 AC-18 BR-11)', async () => {
    const { hook, w } = await setup();
    w.tags.splice(0, 1);
    let count: number | null = 0;
    await act(async () => {
      count = await hook.result.current.list.freshTaskCount(HOME_ID);
    });
    expect(count).toBeNull();
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
    expect(listNames(hook)).toEqual(['Work']);
  });

  it('a rename the server never answers fails after the save timeout, with the failure message (TAG02 AC-19)', async () => {
    const { hook } = await setup();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    server.use(http.patch('/api/tags/:id', () => new Promise<never>(() => {})));
    let pending: Promise<{ ok: boolean }> | undefined;
    act(() => {
      pending = hook.result.current.list.updateTag(HOME_ID, { name: 'House' });
    });
    await act(() => vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS));
    let result: { ok: boolean } | undefined;
    await act(async () => {
      result = await pending;
    });
    expect(result?.ok).toBe(false);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
    expect(listNames(hook)).toEqual(['Home', 'Work']);
  });

  it('a 401 that is not the end of the session still shows the failure message (TAG02 AC-19)', async () => {
    const { hook } = await setup();
    server.use(
      http.patch('/api/tags/:id', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'x' } }, { status: 401 }),
      ),
    );
    let result: { ok: boolean } | undefined;
    await act(async () => {
      result = await hook.result.current.list.updateTag(HOME_ID, { colour: 'red' });
    });
    expect(result?.ok).toBe(false);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });
});
