// tier: integration
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Task } from '../api/types';
import { meSignedIn } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { listBodyFor, serverErrorBody, updateTaskStoring } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { renderWithProviders, screen, waitFor, within } from '../test/utils';

const SAVE_FAILED = 'Could not save your change. It was undone.';
/** Only the notes boxes: the page also holds the add and search boxes, which are textboxes too. */
const NOTES_BOX = /^Notes for /;
const NOT_SAVED = 'Your changes to the notes were not saved.';

/** A stand-in server that keeps what it was told and answers lists by the real server's rules. */
function statefulServer(initial: Task[], options: { failPatch?: boolean } = {}) {
  const stored = initial.map((task) => ({ ...task }));
  server.use(
    meSignedIn,
    http.get('/api/tasks', ({ request }) =>
      HttpResponse.json(listBodyFor(stored, new URL(request.url).searchParams)),
    ),
    options.failPatch
      ? http.patch('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status: 500 }))
      : updateTaskStoring(stored),
  );
  return stored;
}

const rowFor = (title: string) => screen.getByText(title).closest('li') as HTMLElement;
const notesButton = (title: string) => screen.getByRole('button', { name: `Notes for ${title}` });
const notesBox = (title: string) => screen.getByRole('textbox', { name: `Notes for ${title}` });

async function open() {
  const view = renderWithProviders(<App />, { route: '/' });
  await screen.findByRole('list', { name: 'Your tasks' });
  return view;
}

const base = () => [
  buildTask({ id: 'p', title: 'Buy paint', notes: 'Call Ravi 98400 12345' }),
  buildTask({ id: 'q', title: 'Pay invoice', notes: null }),
];

describe('task list: notes', { timeout: 15000 }, () => {
  it('shows "Has notes" only on rows that have notes (AC-6 AC-1)', async () => {
    statefulServer(base());
    await open();
    expect(within(rowFor('Buy paint')).getByText('Has notes')).toBeInTheDocument();
    expect(within(rowFor('Pay invoice')).queryByText('Has notes')).not.toBeInTheDocument();
  });

  it('opens the saved notes, saves a change at once and it survives a reload (AC-7 AC-2)', async () => {
    const stored = statefulServer(base());
    const first = await open();
    await userEvent.click(notesButton('Buy paint'));
    expect(notesBox('Buy paint')).toHaveValue('Call Ravi 98400 12345');
    await userEvent.clear(notesBox('Buy paint'));
    await userEvent.type(notesBox('Buy paint'), 'Call Ravi after 5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('textbox', { name: NOTES_BOX })).not.toBeInTheDocument();
    expect(notesButton('Buy paint')).toHaveFocus();
    await waitFor(() => expect(stored[0].notes).toBe('Call Ravi after 5'));
    first.unmount();

    await open();
    await userEvent.click(notesButton('Buy paint'));
    expect(notesBox('Buy paint')).toHaveValue('Call Ravi after 5');
  });

  it('adds notes to a task that had none: the label appears at once (AC-6 AC-7)', async () => {
    const stored = statefulServer(base());
    await open();
    await userEvent.click(notesButton('Pay invoice'));
    await userEvent.type(notesBox('Pay invoice'), '  ref 4471  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(within(rowFor('Pay invoice')).getByText('Has notes')).toBeInTheDocument();
    await waitFor(() => expect(stored[1].notes).toBe('ref 4471'));
  });

  it('clears the notes after an in-panel confirmation: the label goes (AC-2 AC-6)', async () => {
    const stored = statefulServer(base());
    await open();
    await userEvent.click(notesButton('Buy paint'));
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    expect(screen.getByText('Clear these notes?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    expect(within(rowFor('Buy paint')).queryByText('Has notes')).not.toBeInTheDocument();
    expect(notesButton('Buy paint')).toHaveFocus();
    await waitFor(() => expect(stored[0].notes).toBeNull());
  });

  it('rolls a refused save back, restoring the notes and showing the existing message (AC-7)', async () => {
    statefulServer(base(), { failPatch: true });
    await open();
    await userEvent.click(notesButton('Pay invoice'));
    await userEvent.type(notesBox('Pay invoice'), 'new note');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(within(rowFor('Pay invoice')).queryByText('Has notes')).not.toBeInTheDocument();
    await userEvent.click(notesButton('Pay invoice'));
    expect(notesBox('Pay invoice')).toHaveValue('');
  });

  it('sends nothing when Save changes nothing (DEC-242)', async () => {
    const stored = statefulServer(base());
    let patches = 0;
    server.use(
      http.patch('/api/tasks/:id', () => {
        patches += 1;
        return HttpResponse.json(serverErrorBody, { status: 500 });
      }),
    );
    await open();
    await userEvent.click(notesButton('Buy paint'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(patches).toBe(0);
    expect(stored[0].notes).toBe('Call Ravi 98400 12345');
  });

  it('keeps one panel open at a time, and Escape discards a typed change with the line (AC-8)', async () => {
    statefulServer(base());
    await open();
    await userEvent.click(notesButton('Buy paint'));
    await userEvent.click(notesButton('Pay invoice'));
    expect(screen.getAllByRole('textbox', { name: NOTES_BOX })).toHaveLength(1);
    await userEvent.type(notesBox('Pay invoice'), 'draft');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: NOTES_BOX })).not.toBeInTheDocument();
    expect(screen.getByText(NOT_SAVED)).toBeInTheDocument();
  });

  it('a list reload while a panel is open keeps the typed draft (R-3)', async () => {
    statefulServer(base());
    await open();
    await userEvent.click(notesButton('Buy paint'));
    await userEvent.type(notesBox('Buy paint'), ' and Sam');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'Buy');
    await screen.findByText('Buy paint');
    await waitFor(() => expect(notesBox('Buy paint')).toHaveValue('Call Ravi 98400 12345 and Sam'));
  });

  it('search looks at titles only, so a word found only in notes finds nothing (AC-4 BR search)', async () => {
    statefulServer(base());
    await open();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'Ravi');
    expect(
      await screen.findByText('No tasks match your search.', { selector: '.task-list-empty-text' }),
    ).toBeInTheDocument();
  });

  it('adding a task is still one step: the add form has no notes box (BR add)', async () => {
    statefulServer(base());
    await open();
    expect(screen.queryByRole('textbox', { name: /notes/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New task' })).toBeInTheDocument();
  });
});
