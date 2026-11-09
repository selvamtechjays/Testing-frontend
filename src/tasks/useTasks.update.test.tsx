// tier: integration
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import { server } from '../test/mocks/server';
import { listTasksWith, serverErrorBody } from '../test/mocks/tasks';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
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

async function setup(tasks: Task[]) {
  server.use(listTasksWith(tasks));
  const hook = renderHook(() => ({ list: useTasks(), notice: useFailureNotice() }), { wrapper });
  await waitFor(() => expect(hook.result.current.list.status).not.toBe('loading'));
  return hook;
}

type Hook = Awaited<ReturnType<typeof setup>>;
const view = (hook: Hook) =>
  hook.result.current.list.tasks.map((t) => `${t.id}:${t.title}:${t.status}`);

/** A PATCH handler that waits on a gate, records the body, then answers with what it is told. */
function gatedPatch() {
  const gates: Array<{ release: (status: number) => void; body: unknown }> = [];
  server.use(
    http.patch('/api/tasks/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, string>;
      const status = await new Promise<number>((resolve) => {
        gates.push({ release: resolve, body });
      });
      if (status >= 400) return HttpResponse.json(serverErrorBody, { status });
      return HttpResponse.json({ task: buildTask({ id: String(params.id), ...body } as Task) });
    }),
  );
  return gates;
}

const a = buildTask({ id: 'a', title: 'Alpha', status: 'pending' });
const b = buildTask({ id: 'b', title: 'Bravo', status: 'pending' });
const c = buildTask({ id: 'c', title: 'Charlie', status: 'completed' });

describe('useTasks tick and untick', () => {
  it('shows Completed at once and sends only the status (AC-1 BR-3 BR-5 TS-1)', async () => {
    const hook = await setup([a, b, c]);
    const gates = gatedPatch();
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.toggleStatus('b');
    });
    expect(view(hook)).toContain('b:Bravo:completed');
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(gates[0].body).toEqual({ status: 'completed' });
    await act(async () => {
      gates[0].release(200);
      await done;
    });
    expect(view(hook)).toContain('b:Bravo:completed');
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('unticks a Completed task back to Pending (AC-2 BR-3 TS-2)', async () => {
    const hook = await setup([a, c]);
    const gates = gatedPatch();
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.toggleStatus('c');
    });
    expect(view(hook)).toContain('c:Charlie:pending');
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(gates[0].body).toEqual({ status: 'pending' });
    await act(async () => {
      gates[0].release(200);
      await done;
    });
  });

  it('keeps every task in its place when ticked, unticked or edited (AC-9 BR-6 TS-12 TS-13)', async () => {
    const hook = await setup([a, b, c]);
    const order = () => hook.result.current.list.tasks.map((t) => t.id);
    server.use(
      http.patch('/api/tasks/:id', async ({ request, params }) =>
        HttpResponse.json({
          task: { ...buildTask({ id: String(params.id) }), ...((await request.json()) as object) },
        }),
      ),
    );
    await act(async () => {
      await hook.result.current.list.toggleStatus('b');
      await hook.result.current.list.editTitle('a', 'Alpha edited');
      await hook.result.current.list.editTitle('c', 'Charlie edited');
      await hook.result.current.list.toggleStatus('c');
    });
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it.each([
    [500, 'a 500'],
    [404, 'a 404'],
    [503, 'a 503'],
  ])('restores the earlier status and shows the message on %i (AC-7 BR-5 TS-9)', async (status) => {
    const hook = await setup([a]);
    server.use(http.patch('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status })));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await hook.result.current.list.toggleStatus('a');
    });
    expect(ok).toBe(false);
    expect(view(hook)).toEqual(['a:Alpha:pending']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('restores the earlier status when the network fails (AC-7 AC-8)', async () => {
    const hook = await setup([c]);
    server.use(http.patch('/api/tasks/:id', () => HttpResponse.error()));
    await act(async () => {
      await hook.result.current.list.toggleStatus('c');
    });
    expect(view(hook)).toEqual(['c:Charlie:completed']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });

  it('restores the status on a 401 but shows no save-failed message (DEC-075)', async () => {
    const hook = await setup([a]);
    server.use(
      http.patch('/api/tasks/:id', () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 }),
      ),
    );
    await act(async () => {
      await hook.result.current.list.toggleStatus('a');
    });
    expect(view(hook)).toEqual(['a:Alpha:pending']);
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('makes no request for an unknown id or an unsaved temporary row (R-5)', async () => {
    const hook = await setup([a]);
    let calls = 0;
    server.use(
      http.patch('/api/tasks/:id', () => {
        calls += 1;
        return HttpResponse.json({ task: a });
      }),
    );
    let results: boolean[] = [];
    await act(async () => {
      results = [
        await hook.result.current.list.toggleStatus('nope'),
        await hook.result.current.list.editTitle('temp-1', 'x'),
        await hook.result.current.list.editTitle('a', 'Alpha'),
      ];
    });
    expect(results).toEqual([false, false, true]);
    expect(calls).toBe(0);
  });
});

describe('useTasks title edit', () => {
  it('shows the new title at once and sends only the title (AC-3 BR-5 TS-3)', async () => {
    const hook = await setup([a, b]);
    const gates = gatedPatch();
    let done: Promise<boolean> | undefined;
    act(() => {
      done = hook.result.current.list.editTitle('a', 'Alpha renamed');
    });
    expect(view(hook)).toContain('a:Alpha renamed:pending');
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(gates[0].body).toEqual({ title: 'Alpha renamed' });
    await act(async () => {
      gates[0].release(200);
      await done;
    });
    expect(hook.result.current.notice.message).toBeNull();
  });

  it('restores the previous title and shows the message when the save fails (AC-8 BR-5 TS-10)', async () => {
    const hook = await setup([a, b]);
    server.use(
      http.patch('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status: 500 })),
    );
    await act(async () => {
      await hook.result.current.list.editTitle('a', 'Lost edit');
    });
    expect(view(hook)).toEqual(['a:Alpha:pending', 'b:Bravo:pending']);
    expect(hook.result.current.notice.message).toBe(SAVE_FAILED);
  });
});

describe('useTasks quick successive changes', () => {
  it('when the first of two title edits fails and the second saves, the second stays (AC-8 R-2)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch();
    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    act(() => {
      first = hook.result.current.list.editTitle('a', 'One');
    });
    act(() => {
      second = hook.result.current.list.editTitle('a', 'Two');
    });
    await waitFor(() => expect(gates).toHaveLength(2));
    await act(async () => {
      gates[0].release(500);
      await first;
    });
    expect(view(hook)).toEqual(['a:Two:pending']);
    await act(async () => {
      gates[1].release(200);
      await second;
    });
    expect(view(hook)).toEqual(['a:Two:pending']);
  });

  it('when both title edits fail, the stored title comes back, not the unsaved first one (AC-8 R-2)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch();
    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    act(() => {
      first = hook.result.current.list.editTitle('a', 'One');
    });
    act(() => {
      second = hook.result.current.list.editTitle('a', 'Two');
    });
    await waitFor(() => expect(gates).toHaveLength(2));
    await act(async () => {
      gates[0].release(500);
      await first;
    });
    await act(async () => {
      gates[1].release(500);
      await second;
    });
    expect(view(hook)).toEqual(['a:Alpha:pending']);
  });

  it('when the first succeeds and the second fails, the first value is what comes back (AC-8 R-2)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch();
    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    act(() => {
      first = hook.result.current.list.editTitle('a', 'One');
    });
    act(() => {
      second = hook.result.current.list.editTitle('a', 'Two');
    });
    await waitFor(() => expect(gates).toHaveLength(2));
    await act(async () => {
      gates[0].release(200);
      await first;
    });
    await act(async () => {
      gates[1].release(500);
      await second;
    });
    expect(view(hook)).toEqual(['a:One:pending']);
  });

  it('a failed tick followed by an untick leaves the task Pending, as stored (AC-7)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch();
    let tick: Promise<boolean> | undefined;
    let untick: Promise<boolean> | undefined;
    act(() => {
      tick = hook.result.current.list.toggleStatus('a');
    });
    act(() => {
      untick = hook.result.current.list.toggleStatus('a');
    });
    await waitFor(() => expect(gates).toHaveLength(2));
    await act(async () => {
      gates[0].release(500);
      await tick;
    });
    await act(async () => {
      gates[1].release(200);
      await untick;
    });
    expect(view(hook)).toEqual(['a:Alpha:pending']);
  });

  it('a failed edit never undoes a tick on the same task (R-1)', async () => {
    const hook = await setup([a]);
    const gates = gatedPatch();
    let edit: Promise<boolean> | undefined;
    let tick: Promise<boolean> | undefined;
    act(() => {
      edit = hook.result.current.list.editTitle('a', 'Edited');
    });
    act(() => {
      tick = hook.result.current.list.toggleStatus('a');
    });
    await waitFor(() => expect(gates).toHaveLength(2));
    await act(async () => {
      gates[0].release(500);
      await edit;
    });
    await act(async () => {
      gates[1].release(200);
      await tick;
    });
    expect(view(hook)).toEqual(['a:Alpha:completed']);
  });
});
