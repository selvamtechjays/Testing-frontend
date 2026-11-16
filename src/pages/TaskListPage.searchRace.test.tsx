// tier: integration
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { meSignedIn } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { createTaskReturning, deleteTaskNoContent } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { listedTitles, renderWithProviders, screen, waitFor, within } from '../test/utils';

const milk = buildTask({ id: 'milk', title: 'Buy milk', createdAt: '2026-11-07T10:00:00.000Z' });
const oat = buildTask({ id: 'oat', title: 'Buy oat milk', createdAt: '2026-11-07T09:00:00.000Z' });
const rent = buildTask({ id: 'rent', title: 'Pay rent', createdAt: '2026-11-07T08:00:00.000Z' });
const dog = buildTask({ id: 'dog', title: 'Walk dog', createdAt: '2026-11-07T11:00:00.000Z' });

/** Answers the full list at once and holds every search request until `release` is called. */
function heldSearch() {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = { search: false };
  server.use(
    meSignedIn,
    http.get('/api/tasks', async ({ request }) => {
      if (!new URL(request.url).searchParams.get('search')) {
        return HttpResponse.json({ tasks: [milk, oat, rent] });
      }
      requested.search = true;
      await gate;
      return HttpResponse.json({ tasks: [milk, oat] });
    }),
  );
  return { release, requested };
}

async function searchWhileHeld(requested: { search: boolean }) {
  renderWithProviders(<App />, { route: '/' });
  await userEvent.type(await screen.findByRole('searchbox', { name: 'Search tasks' }), 'milk');
  await waitFor(() => expect(requested.search).toBe(true));
}

describe('task list: a search response lands after the user kept working (DEC-207)', () => {
  it('a task added while a search is pending is still shown when it lands', async () => {
    const { release, requested } = heldSearch();
    server.use(createTaskReturning(dog));
    await searchWhileHeld(requested);

    await userEvent.type(screen.getByLabelText('New task'), 'Walk dog{Enter}');
    await waitFor(() => expect(listedTitles()[0]).toBe('Walk dog'));
    release();
    await waitFor(() => expect(listedTitles()).toEqual(['Walk dog', 'Buy milk', 'Buy oat milk']));
  });

  it('a task whose save is still in flight when the search lands is not shown twice', async () => {
    const { release, requested } = heldSearch();
    let finishSave: () => void = () => {};
    const saving = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    server.use(
      http.post('/api/tasks', async () => {
        await saving;
        return HttpResponse.json({ task: dog }, { status: 201 });
      }),
    );
    await searchWhileHeld(requested);

    await userEvent.type(screen.getByLabelText('New task'), 'Walk dog{Enter}');
    await waitFor(() => expect(listedTitles()[0]).toBe('Walk dog'));
    release();
    await waitFor(() => expect(listedTitles()).toEqual(['Walk dog', 'Buy milk', 'Buy oat milk']));
    finishSave();
    await waitFor(() => expect(screen.getAllByText('Walk dog')).toHaveLength(1));
    expect(listedTitles()).toEqual(['Walk dog', 'Buy milk', 'Buy oat milk']);
  });

  it('a tick made while a search is pending wins over the stale response', async () => {
    const { release, requested } = heldSearch();
    server.use(
      http.patch('/api/tasks/:id', () =>
        HttpResponse.json({ task: { ...milk, status: 'completed' } }),
      ),
    );
    await searchWhileHeld(requested);

    const row = screen.getByText('Buy milk').closest('li') as HTMLElement;
    await userEvent.click(
      within(row).getByRole('checkbox', { name: 'Mark Buy milk as completed' }),
    );
    expect(within(row).getByRole('checkbox')).toBeChecked();
    release();
    await waitFor(() => expect(listedTitles()).toEqual(['Buy milk', 'Buy oat milk']));
    const after = screen.getByText('Buy milk').closest('li') as HTMLElement;
    expect(within(after).getByRole('checkbox')).toBeChecked();
  });

  it('a task deleted while a search is pending does not come back when it lands', async () => {
    const { release, requested } = heldSearch();
    server.use(deleteTaskNoContent);
    await searchWhileHeld(requested);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Buy milk' }));
    expect(listedTitles()).not.toContain('Buy milk');
    release();
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
    expect(listedTitles()).toEqual(['Buy oat milk']);
  });
});
