// tier: integration
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Task } from '../api/types';
import { meSignedIn, unauthenticatedBody } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { serverErrorBody } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { listedTitles, renderWithProviders, screen, waitFor, within } from '../test/utils';

const SAVE_FAILED = 'Could not save your change. It was undone.';

/** A stand-in server that keeps what it was told, so a "reload" shows stored truth. */
function statefulServer(initial: Task[], options: { failPatch?: number } = {}) {
  const stored = initial.map((task) => ({ ...task }));
  server.use(
    meSignedIn,
    http.get('/api/tasks', () => HttpResponse.json({ tasks: stored })),
    http.patch('/api/tasks/:id', async ({ request, params }) => {
      if (options.failPatch) {
        return HttpResponse.json(
          options.failPatch === 401 ? unauthenticatedBody : serverErrorBody,
          { status: options.failPatch },
        );
      }
      const patch = (await request.json()) as Partial<Task>;
      const task = stored.find((t) => t.id === params.id);
      if (!task) return HttpResponse.json(serverErrorBody, { status: 404 });
      Object.assign(task, patch);
      return HttpResponse.json({ task });
    }),
  );
  return stored;
}

const titles = listedTitles;
const rowFor = (title: string) => screen.getByText(title).closest('li') as HTMLElement;

async function open() {
  const view = renderWithProviders(<App />, { route: '/' });
  await screen.findByRole('list', { name: 'Your tasks' });
  return view;
}

const base = () => [
  buildTask({ id: 'n', title: 'Plan launch', status: 'pending' }),
  buildTask({ id: 'm', title: 'Pay hosting invoice', status: 'pending' }),
  buildTask({ id: 'o', title: 'Send logo', status: 'completed' }),
];

describe('task list: tick and untick', { timeout: 15000 }, () => {
  it('shows Completed at once, keeps the row in place, and the stored status survives a reload (AC-1 AC-3 AC-9 TS-1)', async () => {
    const stored = statefulServer(base());
    const first = await open();
    await userEvent.click(
      within(rowFor('Pay hosting invoice')).getByRole('checkbox', {
        name: 'Mark Pay hosting invoice as completed',
      }),
    );
    expect(within(rowFor('Pay hosting invoice')).getByText('Completed')).toBeInTheDocument();
    expect(titles()).toEqual(['Plan launch', 'Pay hosting invoice', 'Send logo']);
    await waitFor(() => expect(stored[1].status).toBe('completed'));
    first.unmount();

    await open();
    expect(within(rowFor('Pay hosting invoice')).getByText('Completed')).toBeInTheDocument();
    expect(within(rowFor('Pay hosting invoice')).getByRole('checkbox')).toBeChecked();
    expect(titles()).toEqual(['Plan launch', 'Pay hosting invoice', 'Send logo']);
  });

  it('returns a Completed task to Pending with the untick (AC-2 TS-2)', async () => {
    const stored = statefulServer(base());
    await open();
    await userEvent.click(within(rowFor('Send logo')).getByRole('checkbox'));
    expect(within(rowFor('Send logo')).getByText('Pending')).toBeInTheDocument();
    await waitFor(() => expect(stored[2].status).toBe('pending'));
  });

  it('keeps several completed tasks listed after a reload (AC-10 TS-14)', async () => {
    statefulServer(base());
    const first = await open();
    await userEvent.click(within(rowFor('Plan launch')).getByRole('checkbox'));
    await userEvent.click(within(rowFor('Pay hosting invoice')).getByRole('checkbox'));
    await waitFor(() => expect(screen.getAllByText('Completed')).toHaveLength(3));
    first.unmount();
    await open();
    expect(screen.getAllByText('Completed')).toHaveLength(3);
    expect(titles()).toHaveLength(3);
  });

  it('puts the status back and shows the shared message when the save fails (AC-7 TS-9)', async () => {
    const stored = statefulServer(base(), { failPatch: 500 });
    await open();
    await userEvent.click(within(rowFor('Pay hosting invoice')).getByRole('checkbox'));
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(within(rowFor('Pay hosting invoice')).getByText('Pending')).toBeInTheDocument();
    expect(within(rowFor('Pay hosting invoice')).getByRole('checkbox')).not.toBeChecked();
    expect(stored[1].status).toBe('pending');
  });

  it('on a 401 puts the status back and routes to sign-in without a message (DEC-075)', async () => {
    statefulServer(base(), { failPatch: 401 });
    await open();
    await userEvent.click(within(rowFor('Plan launch')).getByRole('checkbox'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
  });
});

describe('task list: edit title', { timeout: 15000 }, () => {
  it('shows the new title at once, keeps the row in place, and it survives a reload (AC-3 AC-9 TS-3 TS-13)', async () => {
    const stored = statefulServer(base());
    const first = await open();
    await userEvent.click(
      within(rowFor('Pay hosting invoice')).getByRole('button', { name: 'Edit' }),
    );
    const input = screen.getByRole('textbox', { name: 'Edit title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Pay brightleaf hosting{Enter}');
    expect(titles()).toEqual(['Plan launch', 'Pay brightleaf hosting', 'Send logo']);
    await waitFor(() => expect(stored[1].title).toBe('Pay brightleaf hosting'));
    first.unmount();

    await open();
    expect(titles()).toEqual(['Plan launch', 'Pay brightleaf hosting', 'Send logo']);
  });

  it('refuses an empty title with a message and keeps the old one, sending nothing (AC-5 TS-7)', async () => {
    const stored = statefulServer(base());
    await open();
    await userEvent.click(within(rowFor('Plan launch')).getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Edit title' }));
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title.');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Plan launch')).toBeInTheDocument();
    expect(stored[0].title).toBe('Plan launch');
  });

  it('restores the previous title and shows the shared message when the save fails (AC-8 TS-10)', async () => {
    const stored = statefulServer(base(), { failPatch: 503 });
    await open();
    await userEvent.click(within(rowFor('Plan launch')).getByRole('button', { name: 'Edit' }));
    const input = screen.getByRole('textbox', { name: 'Edit title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Lost edit{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(titles()).toEqual(['Plan launch', 'Pay hosting invoice', 'Send logo']);
    expect(stored[0].title).toBe('Plan launch');
  });

  it('shows an edited HTML title as plain text (AC-3 TS-11)', async () => {
    statefulServer(base());
    await open();
    await userEvent.click(within(rowFor('Plan launch')).getByRole('button', { name: 'Edit' }));
    const input = screen.getByRole('textbox', { name: 'Edit title' });
    await userEvent.clear(input);
    await userEvent.paste('<script>alert(1)</script><img src=x onerror=alert(2)>');
    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByText('<script>alert(1)</script><img src=x onerror=alert(2)>'),
    ).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('edits the title of a Completed task like any other (OQ-TASK-02 built as allowed)', async () => {
    const stored = statefulServer(base());
    await open();
    await userEvent.click(within(rowFor('Send logo')).getByRole('button', { name: 'Edit' }));
    const input = screen.getByRole('textbox', { name: 'Edit title' });
    await userEvent.type(input, ' v2{Enter}');
    await waitFor(() => expect(stored[2].title).toBe('Send logo v2'));
    expect(within(rowFor('Send logo v2')).getByText('Completed')).toBeInTheDocument();
  });
});
