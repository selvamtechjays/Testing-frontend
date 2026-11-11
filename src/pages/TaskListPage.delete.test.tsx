// tier: integration
import { act, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { Task } from '../api/types';
import { UNDO_WINDOW_MS } from '../tasks/usePendingDelete';
import { meSignedIn, unauthenticatedBody } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { serverErrorBody } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { listedTitles, renderWithProviders, screen, waitFor, within } from '../test/utils';

const SAVE_FAILED = 'Could not save your change. It was undone.';

/** A stand-in server that really removes on DELETE, so a re-render (reload) shows stored truth. */
function statefulServer(initial: Task[], options: { failDelete?: number } = {}) {
  const stored = initial.map((task) => ({ ...task }));
  const deletes: string[] = [];
  server.use(
    meSignedIn,
    http.get('/api/tasks', () => HttpResponse.json({ tasks: stored })),
    http.delete('/api/tasks/:id', ({ params }) => {
      deletes.push(String(params.id));
      if (options.failDelete) {
        const body = options.failDelete === 401 ? unauthenticatedBody : serverErrorBody;
        return HttpResponse.json(body, { status: options.failDelete });
      }
      const index = stored.findIndex((task) => task.id === params.id);
      if (index === -1) return HttpResponse.json(serverErrorBody, { status: 404 });
      stored.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { stored, deletes };
}

const base = () => [
  buildTask({ id: 'n', title: 'Plan launch', createdAt: '2026-11-07T12:00:00.000Z' }),
  buildTask({ id: 'm', title: 'Old idea', createdAt: '2026-11-07T10:00:00.000Z' }),
  buildTask({
    id: 'o',
    title: 'Send logo',
    status: 'completed',
    createdAt: '2026-11-07T08:00:00.000Z',
  }),
];

const titles = listedTitles;

async function open() {
  const view = renderWithProviders(<App />, { route: '/' });
  await screen.findByRole('list', { name: 'Your tasks' });
  return view;
}

/**
 * Real timers while the page loads; only the Undo window runs on a fake clock. Testing Library's
 * async helpers wait on a real timeout, so while the clock is fake the test drives the page with
 * synchronous events and reads it with synchronous queries.
 */
function windowClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const pass = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

afterEach(() => {
  vi.useRealTimers();
});

describe('task list: delete with Undo', { timeout: 15000 }, () => {
  it('removes the task at once and shows "Task deleted - Undo" (AC-1 BR-1 TS-1)', async () => {
    const { deletes } = statefulServer(base());
    await open();
    windowClock();
    click('Delete Old idea');
    expect(titles()).toEqual(['Plan launch', 'Send logo']);
    expect(screen.getByRole('status')).toHaveTextContent('Task deleted - Undo');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(deletes).toEqual([]);
  });

  it('Undo brings the task back in its place with no request, even after the window (AC-2 BR-2 TS-2)', async () => {
    const { deletes, stored } = statefulServer(base());
    await open();
    windowClock();
    click('Delete Old idea');
    await pass(3000);
    click('Undo');
    expect(titles()).toEqual(['Plan launch', 'Old idea', 'Send logo']);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await pass(UNDO_WINDOW_MS * 2);
    expect(deletes).toEqual([]);
    expect(stored).toHaveLength(3);
  });

  it('after 5 seconds the message goes, the task stays deleted and a reload agrees (AC-3 AC-5 AC-6 BR-3 TS-3 TS-8)', async () => {
    const { deletes } = statefulServer(base());
    const first = await open();
    windowClock();
    click('Delete Old idea');
    await pass(UNDO_WINDOW_MS - 1);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    await pass(1);
    vi.useRealTimers();
    await waitFor(() => expect(deletes).toEqual(['m']));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(titles()).toEqual(['Plan launch', 'Send logo']);
    first.unmount();

    await open();
    expect(titles()).toEqual(['Plan launch', 'Send logo']);
  });

  it('deletes and undoes a Completed task still Completed (AC-4 TS-4)', async () => {
    statefulServer(base());
    await open();
    windowClock();
    click('Delete Send logo');
    expect(titles()).toEqual(['Plan launch', 'Old idea']);
    click('Undo');
    const row = screen.getByText('Send logo').closest('li') as HTMLElement;
    expect(within(row).getByText('Completed')).toBeInTheDocument();
    expect(within(row).getByRole('checkbox')).toBeChecked();
  });

  it('shows the empty prompt for a deleted only task and Undo restores it (TS-11)', async () => {
    statefulServer([base()[0]]);
    await open();
    windowClock();
    click('Delete Plan launch');
    expect(screen.getByText('No tasks yet. Add your first task above.')).toBeInTheDocument();
    click('Undo');
    expect(titles()).toEqual(['Plan launch']);
  });

  it('puts the task back and shows the shared message when the delete fails (AC-8 BR-4 TS-9)', async () => {
    const { stored } = statefulServer(base(), { failDelete: 503 });
    await open();
    windowClock();
    click('Delete Old idea');
    await pass(UNDO_WINDOW_MS);
    vi.useRealTimers();
    expect(await screen.findByText(SAVE_FAILED)).toBeInTheDocument();
    expect(titles()).toEqual(['Plan launch', 'Old idea', 'Send logo']);
    expect(stored).toHaveLength(3);
  });

  it('on a 401 puts the task back and routes to sign-in without a message (DEC-075)', async () => {
    statefulServer(base(), { failDelete: 401 });
    await open();
    windowClock();
    click('Delete Old idea');
    await pass(UNDO_WINDOW_MS);
    vi.useRealTimers();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
  });

  it('closing the page inside the window sends the delete with keepalive and it is final (AC-7 ASM-026 TS-10)', async () => {
    const { deletes } = statefulServer(base());
    const first = await open();
    windowClock();
    click('Delete Old idea');
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    vi.useRealTimers();
    await waitFor(() => expect(deletes).toEqual(['m']));
    first.unmount();
    await open();
    expect(titles()).toEqual(['Plan launch', 'Send logo']);
  });

  it('a second delete inside the window makes the first final and leaves one Undo (OQ-TASK-03)', async () => {
    const { deletes } = statefulServer(base());
    await open();
    windowClock();
    click('Delete Old idea');
    click('Delete Plan launch');
    vi.useRealTimers();
    await waitFor(() => expect(deletes).toEqual(['m']));
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
    expect(titles()).toEqual(['Send logo']);
  });
});
