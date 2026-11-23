// tier: integration
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { Tag, Task, TaskTag } from '../api/types';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { buildTask } from '../test/builders/task';
import { server } from '../test/mocks/server';
import { listTasksWith, serverErrorBody } from '../test/mocks/tasks';
import { buildTag, listTagsFails, listTagsWith, TAG_MESSAGES } from '../test/mocks/tags';
import { TasksProvider } from './TasksProvider';
import { useTasks } from './useTasks';

const SAVE_FAILED = 'Could not save your change. It was undone.';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <FailureNoticeProvider>
      <TasksProvider>{children}</TasksProvider>
    </FailureNoticeProvider>
  );
}

const asTaskTag = ({ id, name, colour }: Tag): TaskTag => ({ id, name, colour });
const home = buildTag({ id: 'h', name: 'Home', colour: 'green' });
const work = buildTag({ id: 'w', name: 'Work', colour: 'blue' });
const errands = buildTag({ id: 'e', name: 'Errands', colour: 'red' });

async function setup(tasks: Task[], tags: Tag[] = [home, work, errands]) {
  server.use(listTasksWith(tasks), listTagsWith(tags));
  const hook = renderHook(() => ({ list: useTasks(), notice: useFailureNotice() }), { wrapper });
  await waitFor(() => expect(hook.result.current.list.status).not.toBe('loading'));
  await waitFor(() => expect(hook.result.current.list.tagsStatus).not.toBe('loading'));
  return hook;
}

type Hook = Awaited<ReturnType<typeof setup>>;
const tagNames = (hook: Hook, id = 'a') =>
  hook.result.current.list.tasks.find((t) => t.id === id)?.tags.map((t) => t.name);

/** A PATCH handler that records each body and waits on a gate before answering. */
function gatedPatch(task: () => Task) {
  const gates: Array<{ release: (status: number) => void; body: { tagIds?: string[] } }> = [];
  server.use(
    http.patch('/api/tasks/:id', async ({ request }) => {
      const body = (await request.json()) as { tagIds?: string[] };
      const status = await new Promise<number>((resolve) => gates.push({ release: resolve, body }));
      if (status >= 400) {
        const fields = status === 400 ? { tagIds: TAG_MESSAGES.ownTags } : undefined;
        return HttpResponse.json(
          { error: { code: status === 400 ? 'VALIDATION' : 'NOT_FOUND', message: 'x', fields } },
          { status },
        );
      }
      return HttpResponse.json({ task: task() });
    }),
  );
  return gates;
}

const a = buildTask({ id: 'a', title: 'Alpha', tags: [asTaskTag(home)] });

describe('useTasks tag list (FEAT-TAG-03 DEC-265)', () => {
  it('loads the tags once after sign-in, sorted by name ignoring case (TAG03 AC-6)', async () => {
    const hook = await setup([a], [work, buildTag({ id: 'x', name: 'apple' }), home]);
    expect(hook.result.current.list.tags.map((t) => t.name)).toEqual(['apple', 'Home', 'Work']);
    expect(hook.result.current.list.tagsStatus).toBe('ready');
  });

  it('reads a failed first load as failed, and a refresh recovers it (TAG03 AC-6)', async () => {
    server.use(listTasksWith([a]), listTagsFails());
    const hook = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(hook.result.current.tagsStatus).toBe('failed'));
    server.use(listTagsWith([home]));
    await act(() => hook.result.current.refreshTags());
    expect(hook.result.current.tagsStatus).toBe('ready');
    expect(hook.result.current.tags).toHaveLength(1);
  });

  it('keeps the list it has when a later refresh fails (TAG03 AC-25)', async () => {
    const hook = await setup([a]);
    server.use(listTagsFails());
    await act(() => hook.result.current.list.refreshTags());
    expect(hook.result.current.list.tags).toHaveLength(3);
    expect(hook.result.current.list.tagsStatus).toBe('ready');
  });
});

describe('useTasks changeTags (FEAT-TAG-03 AC-6 AC-22 AC-25)', () => {
  it('shows the new chips at once and sends the whole new list (TAG03 AC-6 BR-8)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch(() => ({ ...a, tags: [asTaskTag(errands), asTaskTag(home)] }));
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'e']);
    });
    expect(tagNames(hook)).toEqual(['Errands', 'Home']);
    await waitFor(() => expect(gates).toHaveLength(1));
    // Sent in chip order, by name.
    expect(gates[0].body).toEqual({ tagIds: ['e', 'h'] });
    await act(async () => {
      gates[0].release(200);
      await done;
    });
    expect(tagNames(hook)).toEqual(['Errands', 'Home']);
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('sends an empty list to clear every tag (TAG03 AC-6)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch(() => ({ ...a, tags: [] }));
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', []);
    });
    expect(tagNames(hook)).toEqual([]);
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(gates[0].body).toEqual({ tagIds: [] });
    await act(async () => {
      gates[0].release(200);
      await done;
    });
  });

  it('sends nothing when the list is unchanged (TAG03 AC-6)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch(() => a);
    await act(async () => {
      await hook.result.current.list.changeTags('a', ['h']);
    });
    expect(gates).toHaveLength(0);
  });

  it('rolls back to the earlier tags and shows the failure message when the save fails (TAG03 AC-22 BR-8)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch(() => a);
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'w']);
    });
    expect(tagNames(hook)).toEqual(['Home', 'Work']);
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => {
      gates[0].release(500);
      await done;
    });
    expect(tagNames(hook)).toEqual(['Home']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('rolls back a tick of a tag deleted elsewhere and refreshes the tag list (TAG03 AC-25 BR-15)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch(() => a);
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'w']);
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    server.use(listTagsWith([home, errands]));
    await act(async () => {
      gates[0].release(400);
      await done;
    });
    expect(tagNames(hook)).toEqual(['Home']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
    await waitFor(() =>
      expect(hook.result.current.list.tags.map((t) => t.name)).toEqual(['Errands', 'Home']),
    );
  });

  it('drops a tag deleted elsewhere from the row, so the next tick sends only tags that exist (TAG03 AC-25 BR-15)', async () => {
    const withWork = buildTask({
      id: 'a',
      title: 'Alpha',
      tags: [asTaskTag(home), asTaskTag(work)],
    });
    const hook = await setup([withWork]);
    const gates = gatedPatch(() => ({ ...withWork, tags: [asTaskTag(errands), asTaskTag(home)] }));
    let done: Promise<boolean> | undefined;
    // Work was deleted in another tab; ticking Errands still carries it and is refused.
    server.use(listTagsWith([home, errands]));
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'w', 'e']);
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => {
      gates[0].release(400);
      await done;
    });
    await waitFor(() => expect(tagNames(hook)).toEqual(['Home']));
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'e']);
    });
    await waitFor(() => expect(gates).toHaveLength(2));
    expect(gates[1].body).toEqual({ tagIds: ['e', 'h'] });
    await act(async () => {
      gates[1].release(200);
      expect(await done).toBe(true);
    });
    expect(tagNames(hook)).toEqual(['Errands', 'Home']);
  });

  it('does not reload the tags when the task itself is gone (404) (TAG03 AC-25)', async () => {
    let tagReads = 0;
    const hook = await setup([a]);
    server.use(
      http.get('/api/tags', () => {
        tagReads += 1;
        return HttpResponse.json({ tags: [home, work, errands] });
      }),
    );
    const gates = gatedPatch(() => a);
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'w']);
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => {
      gates[0].release(404);
      await done;
    });
    expect(tagNames(hook)).toEqual(['Home']);
    expect(tagReads).toBe(0);
  });

  it('sends quick ticks on one task one at a time, so the last one is what the server keeps (TAG03 AC-6 BR-8)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch(() => a);
    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    act(() => {
      first = hook.result.current.list.changeTags('a', ['h', 'w']);
    });
    act(() => {
      second = hook.result.current.list.changeTags('a', ['h', 'w', 'e']);
    });
    expect(tagNames(hook)).toEqual(['Errands', 'Home', 'Work']);
    await waitFor(() => expect(gates).toHaveLength(1));
    // The second save waits for the first: nothing can overtake it.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(gates).toHaveLength(1);
    expect(gates[0].body).toEqual({ tagIds: ['h', 'w'] });
    await act(async () => {
      gates[0].release(200);
      await first;
    });
    await waitFor(() => expect(gates).toHaveLength(2));
    expect(gates[1].body).toEqual({ tagIds: ['e', 'h', 'w'] });
    await act(async () => {
      gates[1].release(200);
      await second;
    });
    expect(tagNames(hook)).toEqual(['Errands', 'Home', 'Work']);
  });

  it('a rename while a tick is saving still lets a failed tick roll back, under the new name (TAG03 AC-22 BR-8, TAG02 AC-6)', async () => {
    const hook = await setup([a, buildTask({ id: 'b', title: 'Bravo' })]);
    const gates = gatedPatch(() => a);
    server.use(
      http.patch('/api/tags/:id', () => HttpResponse.json({ tag: { ...home, name: 'House' } })),
    );
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'w']);
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => {
      await hook.result.current.list.updateTag('h', { name: 'House' });
    });
    expect(tagNames(hook)).toEqual(['House', 'Work']);
    // Bravo carries no Home: the rename leaves its row untouched.
    expect(hook.result.current.list.tasks.find((t) => t.id === 'b')?.tags).toEqual([]);
    await act(async () => {
      gates[0].release(500);
      await done;
    });
    expect(tagNames(hook)).toEqual(['House']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('a rename that moves the ticked tag in the order still lets a failed tick roll back (TAG03 AC-22 BR-8)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch(() => a);
    server.use(
      http.patch('/api/tags/:id', () => HttpResponse.json({ tag: { ...errands, name: 'Zoo' } })),
    );
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'e']);
    });
    expect(tagNames(hook)).toEqual(['Errands', 'Home']);
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => {
      await hook.result.current.list.updateTag('e', { name: 'Zoo' });
    });
    expect(tagNames(hook)).toEqual(['Home', 'Zoo']);
    await act(async () => {
      gates[0].release(500);
      await done;
    });
    expect(tagNames(hook)).toEqual(['Home']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('a queued tick refused after a deleted tag was dropped still rolls back (TAG03 AC-25 BR-15)', async () => {
    const bare = buildTask({ id: 'a', title: 'Alpha' });
    const hook = await setup([bare]);
    const gates = gatedPatch(() => bare);
    // Errands was deleted in another tab; the page has not noticed yet.
    server.use(listTagsWith([home, work]));
    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    act(() => {
      first = hook.result.current.list.changeTags('a', ['e']);
    });
    act(() => {
      second = hook.result.current.list.changeTags('a', ['e', 'w']);
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => {
      gates[0].release(400);
      await first;
    });
    await waitFor(() => expect(tagNames(hook)).toEqual(['Work']));
    await waitFor(() => expect(gates).toHaveLength(2));
    await act(async () => {
      gates[1].release(400);
      await second;
    });
    expect(tagNames(hook)).toEqual([]);
  });

  it('keeps a tick still saving when a list request sent after it answers first (TAG03 AC-28 BR-15)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch(() => ({ ...a, tags: [asTaskTag(home), asTaskTag(work)] }));
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'w']);
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    // The list goes out after the tick and the server answers before applying it.
    server.use(listTasksWith([a]));
    act(() => hook.result.current.list.setFilter('status', 'pending'));
    await waitFor(() => expect(hook.result.current.list.searching).toBe(false));
    expect(tagNames(hook)).toEqual(['Home', 'Work']);
    await act(async () => {
      gates[0].release(200);
      await done;
    });
    expect(tagNames(hook)).toEqual(['Home', 'Work']);
  });

  it('does not let a list response that was in flight undo a tick (TAG03 AC-28 BR-15)', async () => {
    const hook = await setup([a]);
    let releaseList: (() => void) | undefined;
    server.use(
      http.get('/api/tasks', async () => {
        await new Promise<void>((resolve) => {
          releaseList = resolve;
        });
        return HttpResponse.json({ tasks: [a] });
      }),
    );
    act(() => hook.result.current.list.setFilter('status', 'pending'));
    await waitFor(() => expect(releaseList).toBeDefined());
    const gates = gatedPatch(() => ({ ...a, tags: [asTaskTag(home), asTaskTag(work)] }));
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.changeTags('a', ['h', 'w']);
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => {
      releaseList?.();
    });
    await waitFor(() => expect(hook.result.current.list.searching).toBe(false));
    expect(tagNames(hook)).toEqual(['Home', 'Work']);
    await act(async () => {
      gates[0].release(200);
      await done;
    });
    expect(tagNames(hook)).toEqual(['Home', 'Work']);
  });
});

/** POST /api/tags handler recording each body and answering with a tag, or a name refusal. */
function createHandler(answer: (name: string) => { tag?: Tag; refusal?: string }) {
  const posts: Array<{ name: string }> = [];
  server.use(
    http.post('/api/tags', async ({ request }) => {
      const body = (await request.json()) as { name: string };
      posts.push(body);
      const { tag, refusal } = answer(body.name);
      if (refusal) {
        return HttpResponse.json(
          { error: { code: 'VALIDATION', message: 'x', fields: { name: refusal } } },
          { status: 400 },
        );
      }
      return HttpResponse.json({ tag }, { status: 201 });
    }),
  );
  return posts;
}

describe('useTasks createTagAndTick (FEAT-TAG-03 AC-7 AC-8 AC-17 AC-23 AC-24)', () => {
  it('creates a gray tag, adds it to the list and ticks it in one step (TAG03 AC-7 BR-10)', async () => {
    const hook = await setup([a]);
    const fresh = buildTag({ id: 'g', name: 'Groceries', colour: 'gray' });
    const posts = createHandler(() => ({ tag: fresh }));
    const gates = gatedPatch(() => ({ ...a, tags: [asTaskTag(fresh), asTaskTag(home)] }));
    let done: Promise<{ ok: boolean }> | undefined;
    act(() => {
      done = hook.result.current.list.createTagAndTick('a', 'Groceries');
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(posts).toEqual([{ name: 'Groceries' }]);
    expect(gates[0].body).toEqual({ tagIds: ['g', 'h'] });
    expect(tagNames(hook)).toEqual(['Groceries', 'Home']);
    expect(hook.result.current.list.tags.map((t) => t.name)).toContain('Groceries');
    await act(async () => {
      gates[0].release(200);
      expect(await done).toEqual({ ok: true });
    });
  });

  it('ticks an existing tag matched ignoring case and creates nothing (TAG03 AC-8 BR-9)', async () => {
    const hook = await setup([a]);
    const posts = createHandler(() => ({ refusal: 'should not be called' }));
    const gates = gatedPatch(() => ({ ...a, tags: [asTaskTag(home), asTaskTag(work)] }));
    let done: Promise<{ ok: boolean }> | undefined;
    act(() => {
      done = hook.result.current.list.createTagAndTick('a', '  wORK ');
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(gates[0].body).toEqual({ tagIds: ['h', 'w'] });
    await act(async () => {
      gates[0].release(200);
      await done;
    });
    expect(posts).toHaveLength(0);
  });

  it('sends an empty name to the server and returns its message with nothing created (TAG03 AC-17)', async () => {
    const hook = await setup([a]);
    const posts = createHandler(() => ({ refusal: TAG_MESSAGES.empty }));
    let result: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      result = await hook.result.current.list.createTagAndTick('a', '   ');
    });
    expect(posts).toEqual([{ name: '   ' }]);
    expect(result).toEqual({ ok: false, message: 'Enter a tag name.' });
    expect(hook.result.current.list.tags).toHaveLength(3);
  });

  it('returns the server message for a name over 30 characters without a refresh (TAG03 AC-18)', async () => {
    const hook = await setup([a]);
    createHandler(() => ({ refusal: TAG_MESSAGES.tooLong }));
    let result: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      result = await hook.result.current.list.createTagAndTick('a', 'x'.repeat(31));
    });
    expect(result).toEqual({ ok: false, message: TAG_MESSAGES.tooLong });
  });

  it('refreshes the tags and ticks the match when a stale page hits a duplicate (TAG03 AC-24 BR-15)', async () => {
    const hook = await setup([a]);
    const fresh = buildTag({ id: 'g', name: 'Groceries' });
    createHandler(() => {
      server.use(listTagsWith([home, work, errands, fresh]));
      return { refusal: TAG_MESSAGES.duplicate };
    });
    const gates = gatedPatch(() => ({ ...a, tags: [asTaskTag(fresh), asTaskTag(home)] }));
    let done: Promise<{ ok: boolean; message?: string }> | undefined;
    act(() => {
      done = hook.result.current.list.createTagAndTick('a', 'groceries');
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(gates[0].body).toEqual({ tagIds: ['g', 'h'] });
    await act(async () => {
      gates[0].release(200);
      expect(await done).toEqual({ ok: true });
    });
  });

  it('keeps the new tag unticked and shows the failure message when adding it fails (TAG03 AC-23 BR-10)', async () => {
    const hook = await setup([a]);
    const fresh = buildTag({ id: 'g', name: 'Groceries' });
    createHandler(() => ({ tag: fresh }));
    const gates = gatedPatch(() => a);
    let done: Promise<{ ok: boolean }> | undefined;
    act(() => {
      done = hook.result.current.list.createTagAndTick('a', 'Groceries');
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => {
      gates[0].release(500);
      expect(await done).toEqual({ ok: false });
    });
    expect(tagNames(hook)).toEqual(['Home']);
    expect(hook.result.current.list.tags.map((t) => t.name)).toContain('Groceries');
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('keeps the new tag unticked and shows the failure message on a task already at 5 tags (TAG03 AC-23)', async () => {
    const five = Array.from({ length: 5 }, (_, i) => buildTag({ id: `f${i}`, name: `F${i}` }));
    const full = buildTask({ id: 'a', title: 'Full', tags: five.map(asTaskTag) });
    const hook = await setup([full], five);
    const fresh = buildTag({ id: 'g', name: 'Groceries' });
    createHandler(() => ({ tag: fresh }));
    const gates = gatedPatch(() => full);
    let result: { ok: boolean } | undefined;
    await act(async () => {
      result = await hook.result.current.list.createTagAndTick('a', 'Groceries');
    });
    expect(result).toEqual({ ok: false });
    expect(gates).toHaveLength(0);
    expect(hook.result.current.list.tags.map((t) => t.name)).toContain('Groceries');
    expect(tagNames(hook)).toHaveLength(5);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('shows the failure message when the create itself fails on the server (TAG03 AC-23)', async () => {
    const hook = await setup([a]);
    server.use(http.post('/api/tags', () => HttpResponse.json(serverErrorBody, { status: 500 })));
    let result: { ok: boolean } | undefined;
    await act(async () => {
      result = await hook.result.current.list.createTagAndTick('a', 'Groceries');
    });
    expect(result).toEqual({ ok: false });
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });
});
