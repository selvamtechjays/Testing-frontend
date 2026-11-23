// tier: integration
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Tag, Task } from '../api/types';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { buildTask } from '../test/builders/task';
import { server } from '../test/mocks/server';
import { buildTag, listTagsFails, listTagsWith, listTasksWithTags } from '../test/mocks/tags';
import { saveFilters } from './listFilters';
import { DEFAULT_FILTERS } from '../api/types';
import { TasksProvider } from './TasksProvider';
import { useTasks } from './useTasks';

const SAVE_FAILED = 'Could not save your change. It was undone.';
const USER = 'u1';
const HOME_ID = 'a1a1a1a1a1a1a1a1a1a1a1a1';
const WORK_ID = 'b2b2b2b2b2b2b2b2b2b2b2b2';
const GONE_ID = 'c3c3c3c3c3c3c3c3c3c3c3c3';

afterEach(() => window.localStorage.clear());

function wrapper({ children }: { children: ReactNode }) {
  return (
    <FailureNoticeProvider>
      <TasksProvider userId={USER}>{children}</TasksProvider>
    </FailureNoticeProvider>
  );
}

const home = buildTag({ id: HOME_ID, name: 'Home', colour: 'green' });
const work = buildTag({ id: WORK_ID, name: 'Work', colour: 'blue' });
const tagOf = ({ id, name, colour }: Tag) => ({ id, name, colour });

const tasks: Task[] = [
  buildTask({ id: 'a', title: 'Alpha', tags: [tagOf(home)] }),
  buildTask({ id: 'b', title: 'Bravo', tags: [tagOf(work)] }),
  buildTask({ id: 'c', title: 'Charlie' }),
];

/** Every list request the page made, as its query string, in order. */
function recordLists(tags: Tag[] = [home, work]) {
  const urls: URLSearchParams[] = [];
  server.use(
    listTagsWith(tags),
    http.get('/api/tasks', ({ request }) => {
      urls.push(new URL(request.url).searchParams);
      return undefined;
    }),
    listTasksWithTags(tasks, tags),
  );
  return urls;
}

async function setup() {
  const hook = renderHook(() => ({ list: useTasks(), notice: useFailureNotice() }), { wrapper });
  await waitFor(() => expect(hook.result.current.list.status).not.toBe('loading'));
  await waitFor(() => expect(hook.result.current.list.tagsStatus).toBe('ready'));
  return hook;
}

const lastOf = (urls: URLSearchParams[]) => urls[urls.length - 1];

const titles = (hook: Awaited<ReturnType<typeof setup>>) =>
  hook.result.current.list.tasks.map((t) => t.title);

describe('useTasks Tag filter (FEAT-TAG-04 AC-4 AC-7 AC-16 to AC-19)', () => {
  it('sends the chosen tag at once and shows only its tasks (TAG04 AC-1 AC-4)', async () => {
    const urls = recordLists();
    const hook = await setup();
    act(() => hook.result.current.list.setFilter('tag', HOME_ID));
    await waitFor(() => expect(titles(hook)).toEqual(['Alpha']));
    expect(lastOf(urls)?.get('tag')).toBe(HOME_ID);
  });

  it('sends none for No tags and shows only untagged tasks (TAG04 AC-2)', async () => {
    const urls = recordLists();
    const hook = await setup();
    act(() => hook.result.current.list.setFilter('tag', 'none'));
    await waitFor(() => expect(titles(hook)).toEqual(['Charlie']));
    expect(lastOf(urls)?.get('tag')).toBe('none');
  });

  it('remembers the choice with the other filters under the per-user key (TAG04 AC-6)', async () => {
    recordLists();
    const hook = await setup();
    act(() => hook.result.current.list.setFilter('tag', WORK_ID));
    expect(JSON.parse(window.localStorage.getItem(`tasknest-filters:${USER}`) ?? '{}').tag).toBe(
      WORK_ID,
    );
  });

  it('aborts the request in flight when the choice changes, so a late answer never wins (TAG04 AC-4)', async () => {
    recordLists();
    const hook = await setup();
    const pending: Array<{ release: () => void; signal: AbortSignal }> = [];
    server.use(
      http.get('/api/tasks', async ({ request }) => {
        const tag = new URL(request.url).searchParams.get('tag');
        await new Promise<void>((resolve) =>
          pending.push({ release: resolve, signal: request.signal }),
        );
        return HttpResponse.json({ tasks: tasks.filter((t) => t.tags.some((x) => x.id === tag)) });
      }),
    );
    act(() => hook.result.current.list.setFilter('tag', HOME_ID));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => hook.result.current.list.setFilter('tag', WORK_ID));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0].signal.aborted).toBe(true);
    await act(async () => pending[1].release());
    await waitFor(() => expect(titles(hook)).toEqual(['Bravo']));
    // The stale Home answer, delivered last, changes nothing.
    await act(async () => {
      pending[0].release();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(titles(hook)).toEqual(['Bravo']);
  });

  it('a chip for a tag made in another tab reads the tags in, then filters by it (TAG04 AC-7 BR-9)', async () => {
    const known = [home];
    const urls = recordLists(known);
    const hook = await setup();
    expect(hook.result.current.list.tags.map((t) => t.name)).toEqual(['Home']);
    // Work is made in another tab; this page's list has not read it yet.
    known.push(work);
    server.use(listTagsWith(known));
    act(() => hook.result.current.list.selectTag(WORK_ID));
    await waitFor(() => expect(lastOf(urls)?.get('tag')).toBe(WORK_ID));
    expect(hook.result.current.list.filters.tag).toBe(WORK_ID);
    await waitFor(() => expect(titles(hook)).toEqual(['Bravo']));
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('a remembered deleted tag reads as Any with no message even when the tag list failed to load (TAG04 AC-16 BR-6)', async () => {
    saveFilters(USER, { ...DEFAULT_FILTERS, tag: GONE_ID });
    server.use(listTagsFails(), listTasksWithTags(tasks, [home, work]));
    const hook = renderHook(() => ({ list: useTasks(), notice: useFailureNotice() }), { wrapper });
    await waitFor(() => expect(hook.result.current.list.filters.tag).toBe('any'));
    await waitFor(() => expect(titles(hook)).toEqual(['Alpha', 'Bravo', 'Charlie']));
    expect(hook.result.current.list.status).toBe('populated');
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('selectTag sets the tag whatever it was and keeps search and the other filters (TAG04 AC-7)', async () => {
    const urls = recordLists();
    const hook = await setup();
    act(() => {
      hook.result.current.list.setFilter('status', 'pending');
      hook.result.current.list.setFilter('tag', 'none');
      hook.result.current.list.setSearch('a');
    });
    await waitFor(() => expect(lastOf(urls)?.get('search')).toBe('a'));
    act(() => hook.result.current.list.selectTag(HOME_ID));
    await waitFor(() => expect(lastOf(urls)?.get('tag')).toBe(HOME_ID));
    expect(lastOf(urls)?.get('status')).toBe('pending');
    expect(lastOf(urls)?.get('search')).toBe('a');
    expect(hook.result.current.list.search).toBe('a');
  });

  it('selecting the chip of the tag already filtered keeps the filter and sends nothing (TAG04 AC-19)', async () => {
    const urls = recordLists();
    const hook = await setup();
    act(() => hook.result.current.list.selectTag(HOME_ID));
    await waitFor(() => expect(titles(hook)).toEqual(['Alpha']));
    const before = urls.length;
    act(() => hook.result.current.list.selectTag(HOME_ID));
    expect(hook.result.current.list.filters.tag).toBe(HOME_ID);
    expect(urls.length).toBe(before);
  });

  it('a remembered tag that still exists is sent once the tag list has answered (TAG04 AC-6)', async () => {
    saveFilters(USER, { ...DEFAULT_FILTERS, tag: WORK_ID });
    const urls = recordLists();
    const hook = await setup();
    expect(titles(hook)).toEqual(['Bravo']);
    expect(urls.map((u) => u.get('tag'))).toEqual([WORK_ID]);
  });

  it('a remembered tag that no longer exists becomes Any before any filtered request, with no message (TAG04 AC-16)', async () => {
    saveFilters(USER, { ...DEFAULT_FILTERS, tag: GONE_ID });
    const urls = recordLists();
    const hook = await setup();
    expect(hook.result.current.list.filters.tag).toBe('any');
    expect(urls.every((u) => u.get('tag') === null)).toBe(true);
    expect(titles(hook)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(hook.result.current.notice.message).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(`tasknest-filters:${USER}`) ?? '{}').tag).toBe(
      'any',
    );
  });

  it('a stored value from before tags existed loads as Any with no message (TAG04 AC-16)', async () => {
    window.localStorage.setItem(
      `tasknest-filters:${USER}`,
      JSON.stringify({ status: 'all', priority: 'all', due: 'any', sort: 'newest' }),
    );
    recordLists();
    const hook = await setup();
    expect(hook.result.current.list.filters.tag).toBe('any');
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('tagDeleted returns the filter to Any at once and reloads when it is the current tag (TAG04 AC-17 BR-7)', async () => {
    const urls = recordLists();
    const hook = await setup();
    act(() => hook.result.current.list.setFilter('tag', HOME_ID));
    await waitFor(() => expect(titles(hook)).toEqual(['Alpha']));
    act(() => hook.result.current.list.tagDeleted(HOME_ID));
    expect(hook.result.current.list.filters.tag).toBe('any');
    await waitFor(() => expect(titles(hook)).toEqual(['Alpha', 'Bravo', 'Charlie']));
    expect(lastOf(urls)?.get('tag')).toBeNull();
  });

  it('tagDeleted for another tag changes nothing and sends nothing (TAG04 AC-17)', async () => {
    const urls = recordLists();
    const hook = await setup();
    act(() => hook.result.current.list.setFilter('tag', HOME_ID));
    await waitFor(() => expect(titles(hook)).toEqual(['Alpha']));
    const before = urls.length;
    act(() => hook.result.current.list.tagDeleted(WORK_ID));
    expect(hook.result.current.list.filters.tag).toBe(HOME_ID);
    expect(urls.length).toBe(before);
  });

  it('a request refused for the tag shows the failure message, refreshes the tags and returns to Any (TAG04 AC-18 BR-12)', async () => {
    const tags = [home, work];
    recordLists(tags);
    const hook = await setup();
    act(() => hook.result.current.list.setFilter('tag', HOME_ID));
    await waitFor(() => expect(titles(hook)).toEqual(['Alpha']));
    // The tag is deleted in another tab: the next request names it as unknown.
    tags.splice(0, 1);
    server.use(listTagsWith(tags));
    act(() => hook.result.current.list.setFilter('status', 'pending'));
    await waitFor(() => expect(hook.result.current.notice.message).toBe(SAVE_FAILED));
    await waitFor(() => expect(hook.result.current.list.tags.map((t) => t.name)).toEqual(['Work']));
    await waitFor(() => expect(hook.result.current.list.filters.tag).toBe('any'));
    await waitFor(() => expect(titles(hook)).toEqual(['Alpha', 'Bravo', 'Charlie']));
  });
});
