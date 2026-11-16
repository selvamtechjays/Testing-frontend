// tier: integration
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Task } from '../api/types';
import { localToday } from '../lib/localDate';
import { meSignedIn, USER } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { listBodyFor, listTasksMatching, serverErrorBody } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import {
  fireEvent,
  listedTitles,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '../test/utils';

const NO_FILTER_MATCH = 'No tasks match your filters.';
const FILTERS_KEY = `tasknest-filters:${USER.id}`;

/** A calendar date a number of days from the local today, built from local parts like the app does. */
function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localToday(date);
}

const rent = buildTask({
  id: 'rent',
  title: 'Pay rent',
  createdAt: '2026-11-07T12:00:00.000Z',
  dueDate: daysFromToday(-3),
  priority: 'high',
});
const milk = buildTask({
  id: 'milk',
  title: 'Buy milk',
  createdAt: '2026-11-07T11:00:00.000Z',
  dueDate: daysFromToday(2),
  priority: 'low',
});
const taxes = buildTask({
  id: 'taxes',
  title: 'File taxes',
  createdAt: '2026-11-07T10:00:00.000Z',
  dueDate: daysFromToday(-9),
  priority: 'medium',
});
const walk = buildTask({
  id: 'walk',
  title: 'Walk dog',
  createdAt: '2026-11-07T09:00:00.000Z',
  dueDate: null,
  priority: 'medium',
  status: 'completed',
});
const all = [rent, milk, taxes, walk];

function renderList(...handlers: Parameters<typeof server.use>) {
  server.use(meSignedIn, ...handlers);
  renderWithProviders(<App />, { route: '/' });
}

/** Records the query string of every GET /api/tasks and answers like the server does. */
function recordingList(tasks: Task[]) {
  const urls: URLSearchParams[] = [];
  const handler = http.get('/api/tasks', ({ request }) => {
    const params = new URL(request.url).searchParams;
    urls.push(params);
    return HttpResponse.json(listBodyFor(tasks, params));
  });
  return { urls, handler };
}

/** Lets the page take in a response that has just been served: a few turns of the event loop. */
const flushResponses = () =>
  act(async () => {
    for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });

const filterGroup = async () =>
  within(await screen.findByRole('group', { name: 'Filter and sort tasks' }));
const select = async (name: string) => (await filterGroup()).getByRole('combobox', { name });
const searchBox = () => screen.findByRole('searchbox', { name: 'Search tasks' });

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('task list: filters, sort and overdue summary (Task-23)', { timeout: 15000 }, () => {
  it('shows tasks from a server that sends no due date or priority, instead of crashing (DEC-210)', async () => {
    // The exact shape an API older than Task-23 returns: neither field, and no overdueCount.
    const bare = {
      id: 'old-1',
      title: 'Pay rent',
      status: 'pending',
      createdAt: '2026-11-07T12:00:00.000Z',
    };
    renderList(http.get('/api/tasks', () => HttpResponse.json({ tasks: [bare] })));
    await waitFor(() => expect(listedTitles()).toEqual(['Pay rent']));
    const list = screen.getByRole('list', { name: 'Your tasks' });
    expect(within(list).getByText(/Medium priority/)).toBeInTheDocument();
    expect(within(list).queryByText(/^Due |Overdue|Due today/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overdue/ })).not.toBeInTheDocument();
  });

  it('sends today on the very first list call, with no filter keys (AC-9 AC-5 DEC-218)', async () => {
    const { urls, handler } = recordingList(all);
    renderList(handler);
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    expect(Object.fromEntries(urls[0])).toEqual({ today: localToday() });
  });

  it('changing a filter updates the list at once, with no pause (AC-11)', async () => {
    const { urls, handler } = recordingList(all);
    renderList(handler);
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    const before = urls.length;
    await userEvent.selectOptions(await select('Status'), 'pending');
    // The search pause is 300 ms; a filter that waited for even that long would miss this window.
    await waitFor(() => expect(urls.length).toBeGreaterThan(before), { timeout: 250 });
    expect(urls[urls.length - 1]?.get('status')).toBe('pending');
    await waitFor(() => expect(listedTitles()).toEqual(['Pay rent', 'Buy milk', 'File taxes']));
  });

  it('combines status, priority and due with the search text (AC-7)', async () => {
    const { urls, handler } = recordingList(all);
    renderList(handler);
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    await userEvent.selectOptions(await select('Due'), 'overdue');
    await userEvent.selectOptions(await select('Priority'), 'high');
    await userEvent.type(await searchBox(), 'rent');
    // The search goes out after its pause: wait for the request that carries it.
    await waitFor(() => expect(urls[urls.length - 1]?.get('search')).toBe('rent'));
    expect(listedTitles()).toEqual(['Pay rent']);
    expect(Object.fromEntries(urls[urls.length - 1] ?? [])).toMatchObject({
      due: 'overdue',
      priority: 'high',
      search: 'rent',
    });
  });

  it('sends sort=due and shows the server order, earliest first and no-date last (AC-6)', async () => {
    const { urls, handler } = recordingList(all);
    renderList(handler);
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    await userEvent.selectOptions(await select('Sort'), 'due');
    await waitFor(() => expect(urls[urls.length - 1]?.get('sort')).toBe('due'));
    await waitFor(() =>
      expect(listedTitles()).toEqual(['File taxes', 'Pay rent', 'Buy milk', 'Walk dog']),
    );
  });

  it('Clear filters shows only while filters are active and keeps the search text (AC-11)', async () => {
    const { urls, handler } = recordingList(all);
    renderList(handler);
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await userEvent.type(await searchBox(), 'o');
    await userEvent.selectOptions(await select('Status'), 'completed');
    await waitFor(() => expect(listedTitles()).toEqual(['Walk dog']));
    // The search text goes out after its pause: wait for a request that carries it.
    await waitFor(() => expect(urls.some((p) => p.get('search') === 'o')).toBe(true));
    await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));
    expect(await searchBox()).toHaveValue('o');
    expect(await select('Status')).toHaveValue('all');
    await waitFor(() =>
      expect(Object.fromEntries(urls[urls.length - 1] ?? [])).toEqual({
        search: 'o',
        today: localToday(),
      }),
    );
    // Of the four tasks only 'Walk dog' has an o in its title, and the kept search still filters.
    expect(listedTitles()).toEqual(['Walk dog']);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('says no tasks match your filters and offers Clear filters, which restores the list (AC-11)', async () => {
    renderList(listTasksMatching([milk]));
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
    await userEvent.selectOptions(await select('Due'), 'overdue');
    expect((await screen.findAllByText(NO_FILTER_MATCH)).length).toBeGreaterThan(0);
    expect(screen.queryByText('No tasks match your search.')).not.toBeInTheDocument();
    const noMatch = screen.getByText(NO_FILTER_MATCH, { selector: 'p.task-list-empty-text' });
    await userEvent.click(
      within(noMatch.parentElement as HTMLElement).getByRole('button', { name: 'Clear filters' }),
    );
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
  });

  it('remembers filters and sort across a reload but not the search text (AC-12 DEC-217)', async () => {
    const first = recordingList(all);
    server.use(meSignedIn, first.handler);
    const { unmount } = renderWithProviders(<App />, { route: '/' });
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    await userEvent.selectOptions(await select('Sort'), 'due');
    await userEvent.selectOptions(await select('Status'), 'pending');
    await userEvent.type(await searchBox(), 'rent');
    await waitFor(() => expect(listedTitles()).toEqual(['Pay rent']));
    expect(JSON.parse(window.localStorage.getItem(FILTERS_KEY) ?? '{}')).toEqual({
      status: 'pending',
      priority: 'all',
      due: 'any',
      sort: 'due',
    });
    unmount();

    const second = recordingList(all);
    server.use(second.handler);
    renderWithProviders(<App />, { route: '/' });
    await waitFor(() => expect(second.urls.length).toBeGreaterThan(0));
    expect(Object.fromEntries(second.urls[0])).toEqual({
      status: 'pending',
      sort: 'due',
      today: localToday(),
    });
    expect(await select('Sort')).toHaveValue('due');
    expect(await select('Status')).toHaveValue('pending');
    expect(await searchBox()).toHaveValue('');
  });

  it("does not use another user's remembered filters (AC-12)", async () => {
    window.localStorage.setItem(
      'tasknest-filters:someone-else',
      JSON.stringify({ status: 'completed', priority: 'all', due: 'any', sort: 'due' }),
    );
    const { urls, handler } = recordingList(all);
    renderList(handler);
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(urls[0].has('status')).toBe(false);
  });

  it('starts on the defaults when storage holds rubbish (AC-12)', async () => {
    window.localStorage.setItem(FILTERS_KEY, '{oops');
    const { urls, handler } = recordingList(all);
    renderList(handler);
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(Object.fromEntries(urls[0])).toEqual({ today: localToday() });
  });

  it('shows N overdue, counting every pending overdue task whatever the filters, and hides it at 0 (AC-13 DEC-212)', async () => {
    renderList(listTasksMatching(all));
    expect(await screen.findByRole('button', { name: '2 overdue' })).toBeInTheDocument();
    await userEvent.selectOptions(await select('Status'), 'completed');
    await waitFor(() => expect(listedTitles()).toEqual(['Walk dog']));
    expect(screen.getByRole('button', { name: '2 overdue' })).toBeInTheDocument();
  });

  it('shows no summary when nothing is overdue (AC-13)', async () => {
    renderList(listTasksMatching([milk, walk]));
    await waitFor(() => expect(listedTitles()).toHaveLength(2));
    expect(screen.queryByRole('button', { name: /overdue$/ })).not.toBeInTheDocument();
  });

  it('selecting the summary applies the Overdue filter and leaves the others alone (AC-13)', async () => {
    renderList(listTasksMatching(all));
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    await userEvent.selectOptions(await select('Sort'), 'due');
    await userEvent.click(await screen.findByRole('button', { name: '2 overdue' }));
    await waitFor(() => expect(listedTitles()).toEqual(['File taxes', 'Pay rent']));
    expect(await select('Due')).toHaveValue('overdue');
    expect(await select('Sort')).toHaveValue('due');
  });

  it('selecting the summary under Status Completed resets the status and keeps priority, sort and search (BLT-summary-status DEC-234)', async () => {
    const { urls, handler } = recordingList(all);
    renderList(handler);
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    await userEvent.type(await searchBox(), 'File');
    await userEvent.selectOptions(await select('Status'), 'completed');
    await userEvent.selectOptions(await select('Priority'), 'medium');
    await userEvent.selectOptions(await select('Sort'), 'due');
    await waitFor(() => expect(listedTitles()).toEqual([]));
    await userEvent.click(await screen.findByRole('button', { name: '2 overdue' }));
    await waitFor(() => expect(listedTitles()).toEqual(['File taxes']));
    expect(await select('Status')).toHaveValue('all');
    expect(await select('Due')).toHaveValue('overdue');
    expect(await select('Priority')).toHaveValue('medium');
    expect(await select('Sort')).toHaveValue('due');
    expect(await searchBox()).toHaveValue('File');
    const last = Object.fromEntries(urls[urls.length - 1] ?? []);
    expect(last).toMatchObject({ due: 'overdue', priority: 'medium', sort: 'due', search: 'File' });
    expect(last).not.toHaveProperty('status');
  });

  it('a sort alone on a list with no tasks shows the empty state, and Clear filters still resets the sort (BLT-sort-not-narrowing)', async () => {
    const { urls, handler } = recordingList([]);
    renderList(handler);
    expect(await screen.findByText('No tasks yet. Add your first task above.')).toBeInTheDocument();
    await userEvent.selectOptions(await select('Sort'), 'due');
    // The request carrying the sort has gone out and been answered before anything is asserted.
    await waitFor(() => expect(urls.some((p) => p.get('sort') === 'due')).toBe(true));
    await flushResponses();
    expect(screen.getByText('No tasks yet. Add your first task above.')).toBeInTheDocument();
    expect(screen.queryByText(NO_FILTER_MATCH)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await select('Sort')).toHaveValue('newest');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('announces the settled result through the polite region (AC-13 AC-15)', async () => {
    renderList(listTasksMatching(all));
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    await userEvent.selectOptions(await select('Due'), 'overdue');
    const live = document.querySelector('[aria-live="polite"]');
    await waitFor(() => expect(live).toHaveTextContent('2 tasks found.'));
  });

  it('a stale response from an earlier filter never replaces the newer one (AC-11)', async () => {
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let staleServed: () => void = () => {};
    const staleWasServed = new Promise<void>((resolve) => {
      staleServed = resolve;
    });
    server.use(
      meSignedIn,
      http.get('/api/tasks', async ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get('status') === 'pending') {
          await firstGate;
          // The older request is answered now, after the newer one has already landed.
          queueMicrotask(staleServed);
        }
        return HttpResponse.json(listBodyFor(all, params));
      }),
    );
    renderWithProviders(<App />, { route: '/' });
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    await userEvent.selectOptions(await select('Status'), 'pending');
    await userEvent.selectOptions(await select('Status'), 'completed');
    await waitFor(() => expect(listedTitles()).toEqual(['Walk dog']));
    releaseFirst();
    await staleWasServed;
    await flushResponses();
    expect(listedTitles()).toEqual(['Walk dog']);
  });

  it('a failed filter request shows the search failure with Retry (EP-TASK-01 400/500)', async () => {
    let fail = false;
    server.use(
      meSignedIn,
      http.get('/api/tasks', ({ request }) => {
        if (fail) return HttpResponse.json(serverErrorBody, { status: 500 });
        return HttpResponse.json(listBodyFor(all, new URL(request.url).searchParams));
      }),
    );
    renderWithProviders(<App />, { route: '/' });
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    fail = true;
    await userEvent.selectOptions(await select('Status'), 'pending');
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(listedTitles()).toHaveLength(3));
  });
});

describe(
  'task list: adding and editing with dates and priority (Task-23)',
  { timeout: 15000 },
  () => {
    it('adds with a date and priority, showing them at once (AC-2)', async () => {
      let body: unknown;
      server.use(
        http.post('/api/tasks', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(
            {
              task: buildTask({
                id: 'new1',
                title: 'Book flights',
                dueDate: '2026-11-20',
                priority: 'high',
              }),
            },
            { status: 201 },
          );
        }),
      );
      renderList(listTasksMatching([milk]));
      await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
      await userEvent.type(screen.getByLabelText('New task'), 'Book flights');
      fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-20' } });
      await userEvent.selectOptions(
        within(screen.getByLabelText('New task').closest('form') as HTMLElement).getByRole(
          'combobox',
          { name: 'Priority' },
        ),
        'high',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await waitFor(() => expect(listedTitles()).toEqual(['Book flights', 'Buy milk']));
      expect(body).toEqual({ title: 'Book flights', dueDate: '2026-11-20', priority: 'high' });
      expect(screen.getByText('High priority')).toBeInTheDocument();
      expect(screen.getByText('Due Nov 20, 2026')).toBeInTheDocument();
    });

    it('adds with neither field in one step: Medium and no date (AC-1)', async () => {
      let body: unknown;
      server.use(
        http.post('/api/tasks', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(
            { task: buildTask({ id: 'new2', title: 'Plain' }) },
            { status: 201 },
          );
        }),
      );
      renderList(listTasksMatching([milk]));
      await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
      await userEvent.type(screen.getByLabelText('New task'), 'Plain{Enter}');
      await waitFor(() => expect(listedTitles()).toEqual(['Plain', 'Buy milk']));
      expect(body).toEqual({ title: 'Plain', priority: 'medium' });
    });

    it('a date edit shows at once and saves only the date (AC-14)', async () => {
      let body: unknown;
      server.use(
        http.patch('/api/tasks/:id', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ task: milk });
        }),
      );
      renderList(listTasksMatching([milk]));
      await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
      const input = screen.getByLabelText('Due date for Buy milk');
      fireEvent.change(input, { target: { value: '2026-12-01' } });
      fireEvent.blur(input);
      expect(input).toHaveValue('2026-12-01');
      await waitFor(() => expect(body).toEqual({ dueDate: '2026-12-01' }));
    });

    it('rolls a refused date edit back and shows the failure notice (AC-14)', async () => {
      server.use(
        http.patch('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status: 500 })),
      );
      renderList(listTasksMatching([milk]));
      await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
      const input = screen.getByLabelText('Due date for Buy milk');
      fireEvent.change(input, { target: { value: '2026-12-01' } });
      fireEvent.blur(input);
      expect(
        await screen.findByText('Could not save your change. It was undone.'),
      ).toBeInTheDocument();
      await waitFor(() => expect(input).toHaveValue(milk.dueDate));
    });

    it('shows a priority edit at once, then rolls a refused one back to the confirmed priority (AC-14)', async () => {
      let refuse: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        refuse = resolve;
      });
      server.use(
        http.patch('/api/tasks/:id', async () => {
          await held;
          return HttpResponse.json(serverErrorBody, { status: 500 });
        }),
      );
      renderList(listTasksMatching([milk]));
      await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
      const priority = screen.getByRole('combobox', { name: 'Priority for Buy milk' });
      await userEvent.selectOptions(priority, 'high');
      // The save has not been answered yet, so this is the optimistic value, not the rollback.
      expect(priority).toHaveValue('high');
      refuse();
      expect(
        await screen.findByText('Could not save your change. It was undone.'),
      ).toBeInTheDocument();
      await waitFor(() => expect(priority).toHaveValue('low'));
    });

    it('Clear date sends a null date and the row loses its due text (AC-3)', async () => {
      let body: unknown;
      server.use(
        http.patch('/api/tasks/:id', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ task: { ...milk, dueDate: null } });
        }),
      );
      renderList(listTasksMatching([milk]));
      await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
      await userEvent.click(screen.getByRole('button', { name: 'Clear date for Buy milk' }));
      await waitFor(() => expect(body).toEqual({ dueDate: null }));
      expect(screen.getByLabelText('Due date for Buy milk')).toHaveValue('');
      expect(
        within(screen.getByRole('list', { name: 'Your tasks' })).queryByText(/^Due /),
      ).not.toBeInTheDocument();
    });

    it('the overdue count drops when an overdue task is completed, and the row stays listed (AC-13 DEC-219)', async () => {
      server.use(
        http.patch('/api/tasks/:id', async ({ request }) =>
          HttpResponse.json({ task: { ...rent, ...((await request.json()) as object) } }),
        ),
      );
      renderList(listTasksMatching([rent, taxes]));
      await screen.findByRole('button', { name: '2 overdue' });
      await userEvent.click(screen.getByRole('checkbox', { name: 'Mark Pay rent as completed' }));
      expect(await screen.findByRole('button', { name: '1 overdue' })).toBeInTheDocument();
      expect(listedTitles()).toEqual(['Pay rent', 'File taxes']);
      expect(
        within(screen.getByRole('list', { name: 'Your tasks' })).getAllByText('Overdue'),
      ).toHaveLength(1);
    });

    it('the overdue count drops when an overdue task is given a later date (AC-13 DEC-219)', async () => {
      server.use(
        http.patch('/api/tasks/:id', async ({ request }) =>
          HttpResponse.json({ task: { ...rent, ...((await request.json()) as object) } }),
        ),
      );
      renderList(listTasksMatching([rent, taxes]));
      await screen.findByRole('button', { name: '2 overdue' });
      const dateBox = screen.getByLabelText('Due date for Pay rent');
      fireEvent.change(dateBox, { target: { value: daysFromToday(10) } });
      fireEvent.blur(dateBox);
      expect(await screen.findByRole('button', { name: '1 overdue' })).toBeInTheDocument();
    });

    it('does not move the count when the save is refused (AC-13 AC-14)', async () => {
      server.use(
        http.patch('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status: 500 })),
      );
      renderList(listTasksMatching([rent, taxes]));
      await screen.findByRole('button', { name: '2 overdue' });
      await userEvent.click(screen.getByRole('checkbox', { name: 'Mark Pay rent as completed' }));
      await screen.findByText('Could not save your change. It was undone.');
      expect(screen.getByRole('button', { name: '2 overdue' })).toBeInTheDocument();
    });

    it('adding an overdue task raises the count once the server has it (AC-13 DEC-219)', async () => {
      server.use(
        http.post('/api/tasks', () =>
          HttpResponse.json(
            { task: buildTask({ id: 'late', title: 'Late one', dueDate: daysFromToday(-1) }) },
            { status: 201 },
          ),
        ),
      );
      renderList(listTasksMatching([rent, milk]));
      await screen.findByRole('button', { name: '1 overdue' });
      await userEvent.type(screen.getByLabelText('New task'), 'Late one');
      fireEvent.change(screen.getByLabelText('Due date'), { target: { value: daysFromToday(-1) } });
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      expect(await screen.findByRole('button', { name: '2 overdue' })).toBeInTheDocument();
    });
  },
);
