// tier: integration
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Tag, Task } from '../api/types';
import { meSignedIn } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { buildTag, listTasksWithTags, tagsManaging, taskTagsStoring } from '../test/mocks/tags';
import { recordListQueries, serverErrorBody } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { listedTitles, renderWithProviders, screen, waitFor, within } from '../test/utils';

const SAVE_FAILED = 'Could not save your change. It was undone.';
const HOME_ID = 'a1a1a1a1a1a1a1a1a1a1a1a1';
const WORK_ID = 'b2b2b2b2b2b2b2b2b2b2b2b2';
const tagOf = ({ id, name, colour }: Tag) => ({ id, name, colour });

function world() {
  const home = buildTag({ id: HOME_ID, name: 'Home', colour: 'green' });
  const work = buildTag({ id: WORK_ID, name: 'Work', colour: 'blue' });
  const tasks: Task[] = [
    buildTask({ id: 'a', title: 'Book dentist', tags: [tagOf(home), tagOf(work)] }),
    buildTask({ id: 'b', title: 'Send report', tags: [tagOf(work)] }),
    buildTask({ id: 'c', title: 'Walk dog' }),
  ];
  return { tags: [home, work], tasks };
}

type World = ReturnType<typeof world>;

function serve(w: World) {
  server.use(
    meSignedIn,
    ...tagsManaging(w.tags, w.tasks),
    listTasksWithTags(w.tasks, w.tags),
    taskTagsStoring(w.tasks, w.tags),
  );
}

async function open(w: World = world()) {
  serve(w);
  const view = renderWithProviders(<App />, { route: '/' });
  await waitFor(() => expect(listedTitles()).toHaveLength(3));
  return { ...view, w };
}

const manageButton = () => screen.getByRole('button', { name: 'Manage tags' });
const panel = () => screen.getByRole('group', { name: 'Manage tags' });
const rowFor = (title: string) => screen.getByText(title).closest('li') as HTMLElement;
const meta = (title: string) =>
  within(rowFor(title).querySelector('.task-row-meta') as HTMLElement);
const nameBox = (name: string) => screen.getByRole('textbox', { name: `Name of tag ${name}` });

async function openPanel() {
  await userEvent.click(manageButton());
  await waitFor(() => expect(panel()).toBeInTheDocument());
}

// The Tag filter is remembered per user; each test starts from the defaults.
beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('task list: Manage tags (FEAT-TAG-02)', { timeout: 20000 }, () => {
  it('opens from the filter bar and lists every tag with its name and the count read from the server (TAG02 AC-1 AC-20)', async () => {
    await open();
    expect(manageButton()).toHaveAttribute('aria-expanded', 'false');
    await openPanel();
    expect(manageButton()).toHaveAttribute('aria-expanded', 'true');
    expect(manageButton()).toHaveAttribute('aria-controls', 'manage-tags-panel');
    expect(nameBox('Home')).toHaveValue('Home');
    expect(
      within(screen.getByRole('group', { name: 'Tag Work' })).getByText('2 tasks'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Tag Home' })).getByText('1 task'),
    ).toBeInTheDocument();
  });

  it('reads the counts afresh each time it opens (TAG02 AC-1)', async () => {
    const { w } = await open();
    await openPanel();
    expect(
      within(screen.getByRole('group', { name: 'Tag Home' })).getByText('1 task'),
    ).toBeInTheDocument();
    await userEvent.click(manageButton());
    expect(screen.queryByRole('group', { name: 'Manage tags' })).not.toBeInTheDocument();
    w.tasks[2].tags = [tagOf(w.tags[0])];
    await openPanel();
    expect(
      await within(screen.getByRole('group', { name: 'Tag Home' })).findByText('2 tasks'),
    ).toBeInTheDocument();
  });

  it('a rename the server accepts shows the new name in the panel and on every row carrying the tag, together (TAG02 AC-2 BR-5)', async () => {
    const { w } = await open();
    await openPanel();
    await userEvent.clear(nameBox('Work'));
    await userEvent.type(nameBox('Work'), 'Office{Enter}');
    expect(await meta('Book dentist').findByText('Office')).toBeInTheDocument();
    expect(meta('Send report').getByText('Office')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name of tag Office' })).toHaveValue('Office');
    expect(w.tags.map((t) => t.name)).toContain('Office');
  });

  it('a refused rename shows the server message beside the field and changes nothing on screen or on rows (TAG02 AC-9 AC-10 BR-4)', async () => {
    await open();
    await openPanel();
    await userEvent.clear(nameBox('Home'));
    await userEvent.type(nameBox('Home'), 'work{Enter}');
    expect(await screen.findByText('You already have a tag with that name.')).toBeInTheDocument();
    expect(meta('Book dentist').getByText('Home')).toBeInTheDocument();
    expect(meta('Book dentist').queryByText('work')).not.toBeInTheDocument();
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
    await userEvent.clear(nameBox('Home'));
    await userEvent.type(nameBox('Home'), '{Enter}');
    expect(await screen.findByText('Enter a tag name.')).toBeInTheDocument();
  });

  it('a recolour the server accepts changes the panel swatch and every chip together (TAG02 AC-3)', async () => {
    await open();
    await openPanel();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Colour of tag Work' }),
      'purple',
    );
    await waitFor(() =>
      expect(meta('Send report').getByText('Work')).toHaveClass('tag-chip--purple'),
    );
    expect(meta('Book dentist').getByText('Work')).toHaveClass('tag-chip--purple');
    expect(screen.getByRole('combobox', { name: 'Colour of tag Work' })).toHaveValue('purple');
  });

  it('delete asks in the panel with a fresh count, and chips go only after the server confirms (TAG02 AC-4 AC-8 AC-17)', async () => {
    const { w } = await open();
    await openPanel();
    w.tasks[2].tags = [tagOf(w.tags[1])];
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Work' }));
    expect(
      await screen.findByText(
        'Delete tag "Work"? It will be removed from 3 tasks. The tasks are kept.',
      ),
    ).toBeInTheDocument();
    expect(meta('Send report').getByText('Work')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Tag Work' })).not.toBeInTheDocument(),
    );
    expect(meta('Book dentist').queryByText('Work')).not.toBeInTheDocument();
    expect(meta('Book dentist').getByText('Home')).toBeInTheDocument();
    expect(listedTitles()).toEqual(['Book dentist', 'Send report', 'Walk dog']);
    expect(w.tags.map((t) => t.name)).toEqual(['Home']);
  });

  it('Keep returns to the list with nothing changed and no request sent (TAG02 AC-5)', async () => {
    const { w } = await open();
    await openPanel();
    let deletes = 0;
    server.use(
      http.delete('/api/tags/:id', () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Work' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Keep' }));
    expect(deletes).toBe(0);
    expect(w.tags).toHaveLength(2);
    expect(meta('Send report').getByText('Work')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete tag Work' })).toHaveFocus();
  });

  it('deleting the tag that is the Tag filter returns the filter to Any at once (TAG02 AC-6)', async () => {
    const sent = recordListQueries();
    await open();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), WORK_ID);
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist', 'Send report']));
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Work' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Tag' })).toHaveValue('any'));
    await waitFor(() => expect(listedTitles()).toHaveLength(3));
    // The select alone cannot tell Any from a missing option: the request says what the state is.
    expect(sent[sent.length - 1]?.has('tag')).toBe(false);
  });

  it('with no tags says so and offers no Create control (TAG02 AC-7)', async () => {
    const w = { tags: [] as Tag[], tasks: [buildTask({ id: 'x', title: 'Solo' })] };
    serve(w);
    renderWithProviders(<App />, { route: '/' });
    await waitFor(() => expect(listedTitles()).toEqual(['Solo']));
    await openPanel();
    expect(
      screen.getByText("No tags yet. Create one from a task's Tags picker."),
    ).toBeInTheDocument();
    expect(within(panel()).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('a rename or delete of a tag removed in another tab shows the failure message and the tag disappears (TAG02 AC-18)', async () => {
    const { w } = await open();
    await openPanel();
    w.tags.splice(0, 1);
    await userEvent.clear(nameBox('Home'));
    await userEvent.type(nameBox('Home'), 'Houses{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Tag Home' })).not.toBeInTheDocument(),
    );
  });

  it('a failed rename or delete changes nothing and shows the failure message (TAG02 AC-19)', async () => {
    const { w } = await open();
    await openPanel();
    server.use(
      http.patch('/api/tags/:id', () => HttpResponse.json(serverErrorBody, { status: 500 })),
      http.delete('/api/tags/:id', () => HttpResponse.json(serverErrorBody, { status: 500 })),
    );
    await userEvent.clear(nameBox('Home'));
    await userEvent.type(nameBox('Home'), 'Houses{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(meta('Book dentist').getByText('Home')).toBeInTheDocument();
    // Clear the rename's message, so the delete has to raise its own.
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Work' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(meta('Send report').getByText('Work')).toBeInTheDocument();
    expect(w.tags).toHaveLength(2);
  });

  it('a tag renamed in another tab shows its new name after the next refresh, not before (TAG02 AC-21)', async () => {
    const { w } = await open();
    w.tags[1].name = 'Office';
    w.tasks.forEach((t) => {
      t.tags = t.tags.map((own) => (own.id === WORK_ID ? { ...own, name: 'Office' } : own));
    });
    // No live sync: the rows keep the old name until something reads the list again.
    expect(meta('Send report').getByText('Work')).toBeInTheDocument();
    await openPanel();
    expect(await screen.findByRole('textbox', { name: 'Name of tag Office' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'pending');
    await waitFor(() => expect(meta('Send report').getByText('Office')).toBeInTheDocument());
    expect(meta('Book dentist').getByText('Office')).toBeInTheDocument();
  });

  it('keeps one panel open: opening Manage tags closes a row panel and the reverse (TAG02 AC-20 BR-13)', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Notes for Walk dog' }));
    expect(screen.getByRole('textbox', { name: 'Notes for Walk dog' })).toBeInTheDocument();
    await openPanel();
    expect(screen.queryByRole('textbox', { name: 'Notes for Walk dog' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tags for Walk dog' }));
    expect(screen.queryByRole('group', { name: 'Manage tags' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tags panel for Walk dog' })).toBeInTheDocument();
  });

  it('Escape closes the panel and returns focus to the Manage tags button (TAG02 AC-20)', async () => {
    await open();
    await openPanel();
    expect(screen.getByRole('heading', { name: 'Manage tags' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Manage tags' })).not.toBeInTheDocument();
    expect(manageButton()).toHaveFocus();
  });

  it('works with the keyboard alone: open, rename, then Keep and Delete in the question (TAG02 AC-20 BR-13)', async () => {
    await open();
    manageButton().focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(panel()).toBeInTheDocument());
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: `Name of tag Home` }));
    await userEvent.keyboard('{Control>}a{/Control}Houses{Enter}');
    expect(await screen.findByRole('textbox', { name: 'Name of tag Houses' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Delete tag Houses' }).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('button', { name: 'Keep' });
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete tag Houses' })).toHaveFocus();
    expect(meta('Book dentist').getByText('Houses')).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('button', { name: 'Keep' });
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(meta('Book dentist').queryByText('Houses')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Manage tags' })).toHaveFocus();
  });

  it('a task waiting out its Undo window still carries its tags and is still counted (TAG03 AC-26 BR-7, TAG02 BR-8)', async () => {
    const { w } = await open();
    const deletes: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'DELETE' && request.url.includes('/api/tasks/'))
        deletes.push(request.url);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Book dentist' }));
    expect(listedTitles()).toEqual(['Send report', 'Walk dog']);
    await openPanel();
    // The delete is still held: Home is on one task, Work on two, as the server still has them.
    expect(
      within(screen.getByRole('group', { name: 'Tag Home' })).getByText('1 task'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Tag Work' })).getByText('2 tasks'),
    ).toBeInTheDocument();
    expect(deletes).toEqual([]);
    expect(w.tasks.map((t) => t.id)).toContain('a');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(listedTitles()).toHaveLength(3));
    expect(meta('Book dentist').getByText('Home')).toBeInTheDocument();
    expect(meta('Book dentist').getByText('Work')).toBeInTheDocument();
    server.events.removeAllListeners('request:start');
  });
});
