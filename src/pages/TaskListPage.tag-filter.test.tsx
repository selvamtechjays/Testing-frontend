// tier: integration
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Tag, Task } from '../api/types';
import { listedTitles } from '../test/utils';
import { meSignedIn, USER } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { buildTag, listTagsWith, listTasksWithTags, taskTagsStoring } from '../test/mocks/tags';
import { recordListQueries } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { renderWithProviders, screen, waitFor, within } from '../test/utils';

const NO_FILTER_MATCH = 'No tasks match your filters.';
const HOME_ID = 'a1a1a1a1a1a1a1a1a1a1a1a1';
const WORK_ID = 'b2b2b2b2b2b2b2b2b2b2b2b2';
const GONE_ID = 'c3c3c3c3c3c3c3c3c3c3c3c3';

const home = () => buildTag({ id: HOME_ID, name: 'Home', colour: 'green' });
const work = () => buildTag({ id: WORK_ID, name: 'Work', colour: 'blue' });
const tagOf = ({ id, name, colour }: Tag) => ({ id, name, colour });

const base = (): { tasks: Task[]; tags: Tag[] } => ({
  tags: [home(), work()],
  tasks: [
    buildTask({ id: 'a', title: 'Book dentist', tags: [tagOf(home())] }),
    buildTask({ id: 'b', title: 'Send report', tags: [tagOf(work())], dueDate: '2000-01-01' }),
    buildTask({ id: 'c', title: 'Walk dog' }),
    buildTask({ id: 'd', title: 'Pay rent', tags: [tagOf(home())], status: 'completed' }),
  ],
});

function serve(world: { tasks: Task[]; tags: Tag[] }) {
  server.use(meSignedIn, listTagsWith(world.tags), listTasksWithTags(world.tasks, world.tags));
}

async function open() {
  const view = renderWithProviders(<App />, { route: '/' });
  await waitFor(() => expect(listedTitles().length).toBeGreaterThan(0));
  await waitFor(() => expect(within(tagSelect()).getAllByRole('option').length).toBeGreaterThan(2));
  return view;
}

const tagSelect = () => screen.getByRole('combobox', { name: 'Tag' });
const chooseTag = (value: string) => userEvent.selectOptions(tagSelect(), value);
const clearButton = () => screen.queryByRole('button', { name: 'Clear filters' });
const rowFor = (title: string) => screen.getByText(title).closest('li') as HTMLElement;

// The Tag filter is remembered per user; each test starts from the defaults.
beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('task list: Tag filter (FEAT-TAG-04)', { timeout: 20000 }, () => {
  it('offers Any, No tags and each tag by name, and a choice narrows the list at once (TAG04 AC-4 AC-1 AC-2)', async () => {
    serve(base());
    await open();
    expect(
      within(tagSelect())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Any', 'No tags', 'Home', 'Work']);
    await chooseTag(HOME_ID);
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist', 'Pay rent']));
    await chooseTag('none');
    await waitFor(() => expect(listedTitles()).toEqual(['Walk dog']));
  });

  it('combines with search and status (TAG04 AC-3)', async () => {
    serve(base());
    await open();
    await chooseTag(HOME_ID);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'pending');
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist']));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'dentist');
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist']));
  });

  it('shows Clear filters when the tag is the only narrowing, and it returns the tag to Any (TAG04 AC-5)', async () => {
    serve(base());
    await open();
    expect(clearButton()).not.toBeInTheDocument();
    await chooseTag(WORK_ID);
    await waitFor(() => expect(listedTitles()).toEqual(['Send report']));
    await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    expect(tagSelect()).toHaveValue('any');
    expect(clearButton()).not.toBeInTheDocument();
  });

  it('says no tasks match your filters, with Clear filters, when nothing matches (TAG04 AC-8)', async () => {
    serve(base());
    await open();
    await chooseTag(WORK_ID);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'completed');
    expect(
      await screen.findByText(NO_FILTER_MATCH, { selector: 'p.task-list-empty-text' }),
    ).toBeInTheDocument();
    const noMatch = screen.getByText(NO_FILTER_MATCH, { selector: 'p.task-list-empty-text' });
    expect(
      within(noMatch.parentElement as HTMLElement).getByRole('button', { name: 'Clear filters' }),
    ).toBeInTheDocument();
  });

  it('remembers the tag across a reload (TAG04 AC-6)', async () => {
    const world = base();
    serve(world);
    const first = await open();
    await chooseTag(HOME_ID);
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist', 'Pay rent']));
    first.unmount();

    serve(world);
    renderWithProviders(<App />, { route: '/' });
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist', 'Pay rent']));
    expect(tagSelect()).toHaveValue(HOME_ID);
  });

  it('selecting a chip filters by that tag keeping the other filters and the search (TAG04 AC-7)', async () => {
    serve(base());
    await open();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'pending');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'o');
    await waitFor(() =>
      expect(listedTitles()).toEqual(['Book dentist', 'Send report', 'Walk dog']),
    );
    await userEvent.click(within(rowFor('Book dentist')).getByRole('button', { name: 'Home' }));
    await waitFor(() => expect(tagSelect()).toHaveValue(HOME_ID));
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('pending');
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('o');
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist']));
  });

  it('selecting the chip of the tag already filtered keeps the filter on it (TAG04 AC-19)', async () => {
    serve(base());
    await open();
    await chooseTag(HOME_ID);
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist', 'Pay rent']));
    await userEvent.click(within(rowFor('Book dentist')).getByRole('button', { name: 'Home' }));
    expect(tagSelect()).toHaveValue(HOME_ID);
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist', 'Pay rent']));
  });

  it('keeps counting every overdue task whatever the tag is, and N overdue keeps the tag (TAG04 AC-9 BR-8)', async () => {
    serve(base());
    await open();
    expect(screen.getByRole('button', { name: '1 overdue' })).toBeInTheDocument();
    await chooseTag(HOME_ID);
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist', 'Pay rent']));
    const summary = screen.getByRole('button', { name: '1 overdue' });
    await userEvent.click(summary);
    expect(tagSelect()).toHaveValue(HOME_ID);
    expect(screen.getByRole('combobox', { name: 'Due' })).toHaveValue('overdue');
    expect(
      await screen.findByText(NO_FILTER_MATCH, { selector: 'p.task-list-empty-text' }),
    ).toBeInTheDocument();
  });

  it('a row whose tag is unticked while that tag is the filter stays until the next change (TAG04 AC-4 ASM-071)', async () => {
    const world = base();
    serve(world);
    server.use(taskTagsStoring(world.tasks, world.tags));
    await open();
    await chooseTag(HOME_ID);
    await waitFor(() => expect(listedTitles()).toEqual(['Book dentist', 'Pay rent']));
    await userEvent.click(screen.getByRole('button', { name: 'Tags for Book dentist' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Home' }));
    await waitFor(() => expect(world.tasks[0].tags).toHaveLength(0));
    expect(listedTitles()).toEqual(['Book dentist', 'Pay rent']);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'completed');
    await waitFor(() => expect(listedTitles()).toEqual(['Pay rent']));
  });

  it('loads a remembered tag that was deleted as Any, with no message and no refused request (TAG04 AC-16)', async () => {
    window.localStorage.setItem(
      `tasknest-filters:${USER.id}`,
      JSON.stringify({ status: 'all', priority: 'all', due: 'any', sort: 'newest', tag: GONE_ID }),
    );
    serve(base());
    renderWithProviders(<App />, { route: '/' });
    await waitFor(() => expect(listedTitles()).toHaveLength(4));
    expect(tagSelect()).toHaveValue('any');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows only Any and No tags for a user with no tags (TAG04 AC-20)', async () => {
    serve({ tags: [], tasks: [buildTask({ id: 'x', title: 'Solo' })] });
    renderWithProviders(<App />, { route: '/' });
    await waitFor(() => expect(listedTitles()).toEqual(['Solo']));
    expect(
      within(tagSelect())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Any', 'No tags']);
  });

  it('title search and the other filters behave as before with the tag on Any (TAG04 AC-24)', async () => {
    serve(base());
    const sent = recordListQueries();
    await open();
    const box = screen.getByRole('searchbox', { name: 'Search tasks' });
    // "Send report" carries the Work tag; with the tag on Any no tag goes out, only the text.
    await userEvent.type(box, 'Work');
    expect(
      await screen.findByText('No tasks match your search.', {
        selector: 'p.task-list-empty-text',
      }),
    ).toBeInTheDocument();
    expect(sent[sent.length - 1]?.get('search')).toBe('Work');
    expect(sent[sent.length - 1]?.has('tag')).toBe(false);
    await userEvent.clear(box);
    await userEvent.type(box, 'report');
    await waitFor(() => expect(listedTitles()).toEqual(['Send report']));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'completed');
    expect(
      await screen.findByText('No tasks match your filters.', {
        selector: 'p.task-list-empty-text',
      }),
    ).toBeInTheDocument();
    expect(sent[sent.length - 1]?.get('status')).toBe('completed');
    expect(sent[sent.length - 1]?.has('tag')).toBe(false);
  });
});
