// tier: integration
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Task } from '../api/types';
import { meSignedIn } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { createTaskReturning, listTasksMatching, serverErrorBody } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { act, fireEvent, listedTitles, renderWithProviders, screen, waitFor } from '../test/utils';

const NO_MATCH = 'No tasks match your search.';
const SEARCH_FAILED = 'Could not search your tasks.';
const LOAD_FAILED = 'Could not load your tasks. Reload the page to try again.';

const milk = buildTask({ title: 'Buy milk', createdAt: '2026-11-07T10:00:00.000Z' });
const rent = buildTask({ title: 'Pay rent', createdAt: '2026-11-07T09:00:00.000Z' });
const all = [milk, rent];

/** Longer than the 300 ms pause before typed text becomes a query. */
const PAST_THE_PAUSE_MS = 450;

/** Runs the page's pause on a fake clock, so a test waits for it without sleeping. */
async function passThePause() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await act(async () => void (await vi.advanceTimersByTimeAsync(PAST_THE_PAUSE_MS)));
  vi.useRealTimers();
}

afterEach(() => {
  vi.useRealTimers();
});

function renderList(...handlers: Parameters<typeof server.use>) {
  server.use(meSignedIn, ...handlers);
  renderWithProviders(<App />, { route: '/' });
}

/** The polite live region that reads a search outcome aloud. */
const liveRegion = () => document.querySelector('[aria-live="polite"]');

const searchBox = () => screen.findByRole('searchbox', { name: 'Search tasks' });

/** Records the `search` value of every GET /api/tasks, and answers like the server does. */
function recordingList(tasks: Task[], failFirstSearches = 0) {
  const searches: Array<string | null> = [];
  let failures = failFirstSearches;
  const handler = http.get('/api/tasks', ({ request }) => {
    const text = new URL(request.url).searchParams.get('search');
    searches.push(text);
    if (text && failures > 0) {
      failures -= 1;
      return HttpResponse.json(serverErrorBody, { status: 500 });
    }
    const needle = (text ?? '').trim().toLowerCase();
    return HttpResponse.json({
      tasks: needle === '' ? tasks : tasks.filter((t) => t.title.toLowerCase().includes(needle)),
    });
  });
  return { searches, handler };
}

describe('task list: search (Task-22)', { timeout: 15000 }, () => {
  it('typing narrows the list to matching titles (AC-1 AC-6)', async () => {
    renderList(listTasksMatching(all));
    await userEvent.type(await searchBox(), 'milk');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
    expect(screen.queryByText('Pay rent')).not.toBeInTheDocument();
  });

  it('ignores capitals in what is typed (AC-2)', async () => {
    renderList(listTasksMatching(all));
    await userEvent.type(await searchBox(), 'MILK');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
  });

  it('clearing the box brings the full list back, newest first (AC-3 AC-6)', async () => {
    renderList(listTasksMatching(all));
    const input = await searchBox();
    await userEvent.type(input, 'milk');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
    await userEvent.clear(input);
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk', 'Pay rent']));
  });

  it('Escape clears the box and restores the full list (AC-6 AC-8)', async () => {
    renderList(listTasksMatching(all));
    const input = await searchBox();
    await userEvent.type(input, 'milk');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk', 'Pay rent']));
  });

  it('sends one request for a burst of typing, after the pause, with the final text (AC-6)', async () => {
    const { searches, handler } = recordingList(all);
    renderList(handler);
    const input = await searchBox();
    expect(searches).toEqual([null]); // the first load, no search
    await userEvent.type(input, 'milk');
    expect(searches).toEqual([null]); // still inside the 300 ms pause
    await waitFor(() => expect(searches).toEqual([null, 'milk']));
  });

  it('sends nothing for spaces only, since the trimmed query is unchanged (AC-3)', async () => {
    const { searches, handler } = recordingList(all);
    renderList(handler);
    const input = await searchBox();
    fireEvent.change(input, { target: { value: '   ' } });
    await passThePause();
    expect(searches).toEqual([null]);
    expect(listedTitles()).toEqual(['Buy milk', 'Pay rent']);
  });

  it('shows the no-match text in place of the list, announced politely (AC-7)', async () => {
    renderList(listTasksMatching(all));
    await userEvent.type(await searchBox(), 'zzz');
    expect(await screen.findAllByText(NO_MATCH)).not.toHaveLength(0);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent(NO_MATCH);
    expect(screen.queryByText('No tasks yet. Add your first task above.')).not.toBeInTheDocument();
  });

  it('announces the number found for a search with results (AC-6 AC-8)', async () => {
    renderList(listTasksMatching(all));
    await userEvent.type(await searchBox(), 'milk');
    await waitFor(() => expect(liveRegion()).toHaveTextContent('1 task found.'));
  });

  it('keeps the current list on screen, marked busy, while a search is in flight (AC-6)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderList(
      http.get('/api/tasks', async ({ request }) => {
        if (new URL(request.url).searchParams.get('search')) await gate;
        return HttpResponse.json({ tasks: all });
      }),
    );
    await userEvent.type(await searchBox(), 'milk');
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(listedTitles()).toEqual(['Buy milk', 'Pay rent']);
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    release();
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
  });

  it('drops a slow response for old text when newer text has been answered (AC-6)', async () => {
    let oldAborted = false;
    let oldRequested = false;
    let releaseOld: () => void = () => {};
    const oldGate = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    renderList(
      http.get('/api/tasks', async ({ request }) => {
        const text = new URL(request.url).searchParams.get('search');
        if (text === 'rent') {
          oldRequested = true;
          request.signal.addEventListener('abort', () => {
            oldAborted = true;
          });
          await oldGate;
          return HttpResponse.json({ tasks: [rent] });
        }
        return HttpResponse.json({ tasks: text === 'milk' ? [milk] : all });
      }),
    );
    const input = await searchBox();
    await userEvent.type(input, 'rent');
    await waitFor(() => expect(oldRequested).toBe(true)); // the "rent" request is now stuck
    await userEvent.clear(input);
    await userEvent.type(input, 'milk');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
    // The superseded request was cancelled, so its answer can no longer reach the list.
    await waitFor(() => expect(oldAborted).toBe(true));
    releaseOld();
    expect(listedTitles()).toEqual(['Buy milk']);
  });

  it('a failed search shows the alert with Retry, not the first-load message (AC-6 DEC-206)', async () => {
    renderList(recordingList(all, 99).handler);
    await userEvent.type(await searchBox(), 'milk');
    expect(await screen.findByRole('alert')).toHaveTextContent(SEARCH_FAILED);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText(LOAD_FAILED)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New task')).not.toBeInTheDocument();
  });

  it('Retry re-runs the same query and shows the result (AC-6 DEC-206)', async () => {
    const { searches, handler } = recordingList(all, 1);
    renderList(handler);
    await userEvent.type(await searchBox(), 'milk');
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
    expect(searches.slice(-2)).toEqual(['milk', 'milk']);
    expect(screen.queryByText(SEARCH_FAILED)).not.toBeInTheDocument();
  });

  it('Retry works from the keyboard (AC-8)', async () => {
    renderList(recordingList(all, 1).handler);
    await userEvent.type(await searchBox(), 'milk');
    const retry = await screen.findByRole('button', { name: 'Retry' });
    retry.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));
  });

  it('a failed first load keeps its own message and offers no search (DEC-206)', async () => {
    renderList(http.get('/api/tasks', () => HttpResponse.json(serverErrorBody, { status: 503 })));
    expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('a task added while searching stays visible until the text changes (DEC-207)', async () => {
    const added = buildTask({ title: 'Walk dog', createdAt: '2026-11-07T11:00:00.000Z' });
    renderList(listTasksMatching(all), createTaskReturning(added));
    const input = await searchBox();
    await userEvent.type(input, 'milk');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk']));

    await userEvent.type(await screen.findByLabelText('New task'), 'Walk dog{Enter}');
    await waitFor(() => expect(listedTitles()).toEqual(['Walk dog', 'Buy milk']));
    // Still there after the pause: nothing re-filters it.
    await passThePause();
    expect(listedTitles()).toEqual(['Walk dog', 'Buy milk']);

    await userEvent.type(input, 's'); // text changes to "milks": a new query
    expect(await screen.findAllByText(NO_MATCH)).not.toHaveLength(0);
  });

  it('adding stays possible when nothing matches (DEC-207)', async () => {
    renderList(listTasksMatching(all));
    await userEvent.type(await searchBox(), 'zzz');
    await screen.findAllByText(NO_MATCH);
    expect(screen.getByLabelText('New task')).toBeInTheDocument();
  });

  it('shows the whole list again, not the no-match text, once the box is empty (AC-3 AC-7)', async () => {
    renderList(listTasksMatching(all));
    const input = await searchBox();
    await userEvent.type(input, 'zzz');
    await screen.findAllByText(NO_MATCH);
    await userEvent.clear(input);
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk', 'Pay rent']));
    expect(screen.queryByText(NO_MATCH)).not.toBeInTheDocument();
  });
});
