// tier: integration
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Task } from '../api/types';
import { USER, meSignedIn, unauthenticatedBody } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import {
  createTaskFails,
  createTaskReturning,
  listTasksEmpty,
  listTasksFails,
  listTasksWith,
} from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { listedTitles, renderWithProviders, screen, waitFor, within } from '../test/utils';

const SAVE_FAILED = 'Could not save your change. It was undone.';

async function renderList(...handlers: Parameters<typeof server.use>) {
  server.use(meSignedIn, ...handlers);
  renderWithProviders(<App />, { route: '/' });
}

const rowTitles = listedTitles;

async function addByEnter(title: string) {
  const input = await screen.findByLabelText('New task');
  await userEvent.type(input, `${title}{Enter}`);
}

describe('task list: loading and showing tasks', { timeout: 15000 }, () => {
  it('shows only the word Loading while the first load is in flight, with no add control (AC-1)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await renderList(
      http.get('/api/tasks', async () => {
        await gate;
        return HttpResponse.json({ tasks: [] });
      }),
    );
    expect(await screen.findByText('Loading')).toBeInTheDocument();
    expect(screen.queryByLabelText('New task')).not.toBeInTheDocument();
    release();
    expect(await screen.findByLabelText('New task')).toBeInTheDocument();
  });

  it('lists the tasks newest first, each marked Pending or Completed (AC-1 AC-2 TS-1)', async () => {
    await renderList(
      listTasksWith([
        buildTask({ title: 'Plan launch', status: 'pending' }),
        buildTask({ title: 'Pay hosting invoice', status: 'pending' }),
        buildTask({ title: 'Send logo', status: 'completed' }),
      ]),
    );
    await screen.findByText('Plan launch');
    expect(rowTitles()).toEqual(['Plan launch', 'Pay hosting invoice', 'Send logo']);
    expect(screen.getAllByText('Pending')).toHaveLength(2);
    expect(screen.getAllByText('Completed')).toHaveLength(1);
  });

  it('keeps completed tasks visible after a reload (AC-9 TS-14)', async () => {
    await renderList(listTasksWith([buildTask({ title: 'Done thing', status: 'completed' })]));
    expect(await screen.findByText('Done thing')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows an empty-list prompt to add a first task (AC-3 TS-2)', async () => {
    await renderList(listTasksEmpty);
    expect(await screen.findByText('No tasks yet. Add your first task above.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows a load-failed message when the list cannot be fetched (plan section 5)', async () => {
    await renderList(listTasksFails(503));
    expect(
      await screen.findByText('Could not load your tasks. Reload the page to try again.'),
    ).toBeInTheDocument();
  });

  it('shows no add form after a failed load, only the load-failed alert (CR-1)', async () => {
    await renderList(listTasksFails(503));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your tasks. Reload the page to try again.',
    );
    expect(screen.queryByLabelText('New task')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('renders an HTML title from the server as plain text (AC-4 TS-12 R-4)', async () => {
    const title = '<img src=x onerror=alert(1)>';
    await renderList(listTasksWith([buildTask({ title })]));
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('routes to sign-in when the list answers 401, with no failure message (AC-10 DEC-074)', async () => {
    await renderList(
      http.get('/api/tasks', () => HttpResponse.json(unauthenticatedBody, { status: 401 })),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
  });
});

describe('task list: adding a task', { timeout: 15000 }, () => {
  it('shows the new task at the top at once, with no spinner, then keeps it once saved (AC-4 BR-7 TS-3)', async () => {
    const stored = buildTask({ id: 'real-1', title: 'Send brand colours to Techjays' });
    const older = buildTask({ title: 'Older task' });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let body: unknown;
    await renderList(
      listTasksWith([older]),
      http.post('/api/tasks', async ({ request }) => {
        body = await request.json();
        await gate;
        return HttpResponse.json({ task: stored }, { status: 201 });
      }),
    );
    await screen.findByText('Older task');
    await addByEnter('Send brand colours to Techjays');
    // The server has not answered yet, and the row is already there.
    expect(rowTitles()).toEqual(['Send brand colours to Techjays', 'Older task']);
    expect(within(screen.getAllByRole('listitem')[0]).getByText('Pending')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    release();
    await waitFor(() => expect(body).toEqual({ title: 'Send brand colours to Techjays' }));
    expect(rowTitles()).toEqual(['Send brand colours to Techjays', 'Older task']);
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
    expect(screen.getByLabelText('New task')).toHaveValue('');
  });

  it('puts each new task above the earlier ones (AC-11 TS-17)', async () => {
    const queue: Task[] = [
      buildTask({ id: 'r1', title: 'First' }),
      buildTask({ id: 'r2', title: 'Second' }),
    ];
    await renderList(
      listTasksEmpty,
      http.post('/api/tasks', () => HttpResponse.json({ task: queue.shift() }, { status: 201 })),
    );
    await addByEnter('First');
    await waitFor(() => expect(queue).toHaveLength(1));
    await addByEnter('Second');
    await waitFor(() => expect(queue).toHaveLength(0));
    expect(rowTitles()).toEqual(['Second', 'First']);
  });

  it('adds a title with emoji, accents and CJK exactly as typed (AC-4 TS-7)', async () => {
    const title = 'Plan 🚀 café 計画';
    await renderList(listTasksEmpty, createTaskReturning(buildTask({ id: 'r1', title })));
    await addByEnter(title);
    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it('accepts a title of exactly 200 characters and sends it whole (AC-5 TS-6)', async () => {
    const title = 'w'.repeat(200);
    let sent: { title?: string } = {};
    await renderList(
      listTasksEmpty,
      http.post('/api/tasks', async ({ request }) => {
        sent = (await request.json()) as { title?: string };
        return HttpResponse.json({ task: buildTask({ id: 'r1', title }) }, { status: 201 });
      }),
    );
    const input = await screen.findByLabelText('New task');
    await userEvent.click(input);
    await userEvent.paste(title);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(sent.title).toBe(title));
  });

  it('sends nothing for an empty or spaces-only title (AC-6 TS-8)', async () => {
    let posts = 0;
    await renderList(
      listTasksEmpty,
      http.post('/api/tasks', () => {
        posts += 1;
        return HttpResponse.json({ task: buildTask() }, { status: 201 });
      }),
    );
    await addByEnter('');
    await addByEnter('   ');
    expect(posts).toBe(0);
    expect(await screen.findByText('No tasks yet. Add your first task above.')).toBeInTheDocument();
  });

  it('removes the new task and shows the shared message when the save fails (AC-12 BR-7 TS-13)', async () => {
    await renderList(listTasksWith([buildTask({ title: 'Older task' })]), createTaskFails(500));
    await screen.findByText('Older task');
    await addByEnter('Doomed task');
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(rowTitles()).toEqual(['Older task']);
    expect(screen.queryByText('Doomed task')).not.toBeInTheDocument();
  });

  it('rolls an add back the same way when the network fails (AC-12 AC-8)', async () => {
    await renderList(
      listTasksEmpty,
      http.post('/api/tasks', () => HttpResponse.error()),
    );
    await addByEnter('Lost task');
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(screen.queryByText('Lost task')).not.toBeInTheDocument();
    expect(screen.getByText('No tasks yet. Add your first task above.')).toBeInTheDocument();
  });

  it('on a 401 undoes the add and routes to sign-in without a save-failed message (DEC-075)', async () => {
    await renderList(
      listTasksEmpty,
      http.post('/api/tasks', () => HttpResponse.json(unauthenticatedBody, { status: 401 })),
    );
    await addByEnter('Expired session task');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
  });

  it('stores nothing in the browser (plan section 2 stored data)', async () => {
    await renderList(listTasksEmpty, createTaskReturning(buildTask({ id: 'r1', title: 'Kept' })));
    await addByEnter('Kept');
    await screen.findByText('Kept');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe('task list: privacy across users', { timeout: 15000 }, () => {
  it('shows a different user only their own tasks after sign-out and sign-in (AC-10 TS-15)', async () => {
    let current: Task[] = [buildTask({ title: 'Alice private task' })];
    server.use(
      meSignedIn,
      http.get('/api/tasks', () => HttpResponse.json({ tasks: current })),
      http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
      http.post('/api/auth/login', () =>
        HttpResponse.json({ user: { ...USER, id: 'bob-id', username: 'bob' } }),
      ),
    );
    renderWithProviders(<App />, { route: '/' });
    expect(await screen.findByText('Alice private task')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    current = [buildTask({ title: 'Bob own task' })];
    await userEvent.type(screen.getByLabelText('Username'), 'bob');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Bob own task')).toBeInTheDocument();
    expect(screen.queryByText('Alice private task')).not.toBeInTheDocument();
  });
});
