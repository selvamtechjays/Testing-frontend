// tier: integration
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Tag, Task, TaskTag } from '../api/types';
import { meSignedIn } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { buildTag, tagsStoring, taskTagsStoring, TAG_MESSAGES } from '../test/mocks/tags';
import { listBodyFor, recordListQueries, serverErrorBody } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { listedTitles, renderWithProviders, screen, waitFor, within } from '../test/utils';

const SAVE_FAILED = 'Could not save your change. It was undone.';

const asTaskTag = ({ id, name, colour }: Tag): TaskTag => ({ id, name, colour });
const home = () => buildTag({ id: 'h', name: 'Home', colour: 'green' });
const work = () => buildTag({ id: 'w', name: 'Work', colour: 'blue' });
const errands = () => buildTag({ id: 'e', name: 'Errands', colour: 'red' });

interface World {
  tasks: Task[];
  tags: Tag[];
}

/** A stand-in server that keeps tasks and tags and answers by the plan's rules. */
function statefulServer(world: World, options: { failPatch?: boolean } = {}) {
  server.use(
    meSignedIn,
    http.get('/api/tasks', ({ request }) =>
      HttpResponse.json(listBodyFor(world.tasks, new URL(request.url).searchParams)),
    ),
    ...tagsStoring(world.tags),
    options.failPatch
      ? http.patch('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status: 500 }))
      : taskTagsStoring(world.tasks, world.tags),
  );
}

const rowFor = (title: string) => screen.getByText(title).closest('li') as HTMLElement;
/** The chips line of a row: the picker, when open, repeats every name inside the same row. */
const metaFor = (title: string) =>
  within(rowFor(title).querySelector('.task-row-meta') as HTMLElement);
const tagsButton = (title: string) => screen.getByRole('button', { name: `Tags for ${title}` });
const panelFor = (title: string) => screen.getByRole('group', { name: `Tags panel for ${title}` });
const createBox = () => screen.getByRole('textbox', { name: 'Create tag' });

async function open() {
  const view = renderWithProviders(<App />, { route: '/' });
  await screen.findByRole('list', { name: 'Your tasks' });
  return view;
}

const base = (): World => ({
  tags: [home(), work(), errands()],
  tasks: [
    buildTask({ id: 'p', title: 'Buy paint', tags: [asTaskTag(work()), asTaskTag(errands())] }),
    buildTask({ id: 'q', title: 'Pay invoice' }),
  ],
});

// The Tag filter is remembered per user; each test starts from the defaults.
beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('task list: tags', { timeout: 20000 }, () => {
  it('shows each row tags as chips with the name, and none for an untagged row (TAG03 AC-5 AC-4)', async () => {
    statefulServer(base());
    await open();
    const chips = metaFor('Buy paint');
    expect(chips.getByText('Errands')).toBeInTheDocument();
    expect(chips.getByText('Work')).toBeInTheDocument();
    expect(metaFor('Pay invoice').queryByText('Work')).not.toBeInTheDocument();
  });

  it('ticks a tag: the chip shows at once, the full list is saved and it survives a reload (TAG03 AC-6 AC-4)', async () => {
    const world = base();
    statefulServer(world);
    const first = await open();
    await userEvent.click(tagsButton('Pay invoice'));
    await userEvent.click(within(panelFor('Pay invoice')).getByRole('checkbox', { name: 'Home' }));
    expect(metaFor('Pay invoice').getByText('Home')).toBeInTheDocument();
    await waitFor(() => expect(world.tasks[1].tags.map((t) => t.name)).toEqual(['Home']));
    first.unmount();

    await open();
    expect(metaFor('Pay invoice').getByText('Home')).toBeInTheDocument();
  });

  it('unticks a tag: the chip goes at once and the list saved has one less (TAG03 AC-6)', async () => {
    const world = base();
    statefulServer(world);
    await open();
    await userEvent.click(tagsButton('Buy paint'));
    await userEvent.click(within(panelFor('Buy paint')).getByRole('checkbox', { name: 'Work' }));
    expect(metaFor('Buy paint').queryByText('Work')).not.toBeInTheDocument();
    await waitFor(() => expect(world.tasks[0].tags.map((t) => t.name)).toEqual(['Errands']));
  });

  it('puts the row back and shows the failure message when the save fails (TAG03 AC-22)', async () => {
    statefulServer(base(), { failPatch: true });
    await open();
    await userEvent.click(tagsButton('Pay invoice'));
    await userEvent.click(within(panelFor('Pay invoice')).getByRole('checkbox', { name: 'Home' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(metaFor('Pay invoice').queryByText('Home')).not.toBeInTheDocument();
    expect(
      within(panelFor('Pay invoice')).getByRole('checkbox', { name: 'Home' }),
    ).not.toBeChecked();
  });

  it('creates a gray tag from Create tag and puts it on the task, in the picker and the list (TAG03 AC-7)', async () => {
    const world = base();
    statefulServer(world);
    await open();
    await userEvent.click(tagsButton('Pay invoice'));
    await userEvent.type(createBox(), 'Groceries{Enter}');
    expect(await metaFor('Pay invoice').findByText('Groceries')).toHaveClass('tag-chip--gray');
    expect(
      within(panelFor('Pay invoice')).getByRole('checkbox', { name: 'Groceries' }),
    ).toBeChecked();
    await waitFor(() => expect(world.tasks[1].tags.map((t) => t.name)).toEqual(['Groceries']));
    expect(world.tags.map((t) => t.name)).toContain('Groceries');
    expect(createBox()).toHaveValue('');
    // The Tag filter offers it at once, without a reload (BR-16).
    expect(
      within(screen.getByRole('combobox', { name: 'Tag' }))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toContain('Groceries');
  });

  it('ticks the existing tag when the typed name matches ignoring case and creates nothing (TAG03 AC-8)', async () => {
    const world = base();
    statefulServer(world);
    await open();
    await userEvent.click(tagsButton('Pay invoice'));
    await userEvent.type(createBox(), 'hOME{Enter}');
    expect(await metaFor('Pay invoice').findByText('Home')).toBeInTheDocument();
    expect(world.tags).toHaveLength(3);
  });

  it('shows the server message beside Create tag for an empty or too long name (TAG03 AC-17 AC-18)', async () => {
    const world = base();
    statefulServer(world);
    await open();
    await userEvent.click(tagsButton('Pay invoice'));
    await userEvent.type(createBox(), '   {Enter}');
    expect(await screen.findByText(TAG_MESSAGES.empty)).toBeInTheDocument();
    await userEvent.clear(createBox());
    await userEvent.type(createBox(), `${'a'.repeat(31)}{Enter}`);
    expect(await screen.findByText(TAG_MESSAGES.tooLong)).toBeInTheDocument();
    expect(world.tags).toHaveLength(3);
    await userEvent.clear(createBox());
    await userEvent.type(createBox(), `${'b'.repeat(30)}{Enter}`);
    expect(await metaFor('Pay invoice').findByText('b'.repeat(30))).toBeInTheDocument();
  });

  it('on a stale page, a duplicate refusal refreshes the tags and ticks the existing one (TAG03 AC-24)', async () => {
    const world = base();
    statefulServer(world);
    await open();
    world.tags.push(buildTag({ id: 'g', name: 'Groceries' }));
    await userEvent.click(tagsButton('Pay invoice'));
    await userEvent.type(createBox(), 'groceries{Enter}');
    expect(await metaFor('Pay invoice').findByText('Groceries')).toBeInTheDocument();
    expect(world.tags.filter((t) => t.name.toLowerCase() === 'groceries')).toHaveLength(1);
    expect(screen.queryByText(TAG_MESSAGES.duplicate)).not.toBeInTheDocument();
  });

  it('a tag deleted in another tab is refused: the row returns, the notice shows, the tag leaves the picker (TAG03 AC-25)', async () => {
    const world = base();
    statefulServer(world);
    await open();
    await userEvent.click(tagsButton('Pay invoice'));
    world.tags.splice(0, 1);
    await userEvent.click(within(panelFor('Pay invoice')).getByRole('checkbox', { name: 'Home' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(metaFor('Pay invoice').queryByText('Home')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(within(panelFor('Pay invoice')).queryByRole('checkbox', { name: 'Home' })).toBeNull(),
    );
    // It leaves the Tag filter too.
    expect(
      within(screen.getByRole('combobox', { name: 'Tag' }))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).not.toContain('Home');
  });

  it('a list response that lands after a tick does not undo it (TAG03 AC-28)', async () => {
    const world = base();
    statefulServer(world);
    await open();
    let release: (() => void) | undefined;
    // The stale answer also renames another row, so the test can see when it has landed.
    const stale = (JSON.parse(JSON.stringify(world.tasks)) as Task[]).map((task) =>
      task.id === 'p' ? { ...task, title: 'Buy paint (stale)' } : task,
    );
    server.use(
      http.get('/api/tasks', async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.json({ tasks: stale });
      }),
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'priority');
    await waitFor(() => expect(release).toBeDefined());
    await userEvent.click(tagsButton('Pay invoice'));
    await userEvent.click(within(panelFor('Pay invoice')).getByRole('checkbox', { name: 'Home' }));
    await waitFor(() => expect(world.tasks[1].tags).toHaveLength(1));
    release?.();
    expect(await screen.findByText('Buy paint (stale)')).toBeInTheDocument();
    expect(metaFor('Pay invoice').getByText('Home')).toBeInTheDocument();
  });

  it('at five tags the others are disabled with the note (TAG03 AC-19)', async () => {
    const tags = Array.from({ length: 6 }, (_, i) => buildTag({ id: `t${i}`, name: `Tag ${i}` }));
    const world: World = {
      tags,
      tasks: [buildTask({ id: 'p', title: 'Buy paint', tags: tags.slice(0, 5).map(asTaskTag) })],
    };
    statefulServer(world);
    await open();
    await userEvent.click(tagsButton('Buy paint'));
    expect(screen.getByText('A task can have up to 5 tags.')).toBeInTheDocument();
    expect(within(panelFor('Buy paint')).getByRole('checkbox', { name: 'Tag 5' })).toBeDisabled();
  });

  it('a user at fifty tags has Create tag disabled with the note (TAG03 AC-20)', async () => {
    const tags = Array.from({ length: 50 }, (_, i) => buildTag({ id: `t${i}`, name: `Tag ${i}` }));
    statefulServer({ tags, tasks: [buildTask({ id: 'p', title: 'Buy paint' })] });
    await open();
    await userEvent.click(tagsButton('Buy paint'));
    expect(createBox()).toBeDisabled();
    expect(screen.getByText('You can have up to 50 tags.')).toBeInTheDocument();
  });

  it('keeps one panel open at a time, Escape closes the picker and focus returns (TAG03 AC-27)', async () => {
    statefulServer(base());
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Notes for Buy paint' }));
    await userEvent.click(tagsButton('Pay invoice'));
    expect(screen.queryByRole('textbox', { name: 'Notes for Buy paint' })).not.toBeInTheDocument();
    expect(panelFor('Pay invoice')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: /^Tags panel for/ })).not.toBeInTheDocument();
    expect(tagsButton('Pay invoice')).toHaveFocus();
    await userEvent.click(tagsButton('Pay invoice'));
    expect(
      within(panelFor('Pay invoice')).getByRole('checkbox', { name: 'Home' }),
    ).toBeInTheDocument();
  });

  it('gives the add form no tags field and a row not yet saved no usable Tags control (TAG03 AC-21 AC-26)', async () => {
    statefulServer(base());
    let release: (() => void) | undefined;
    server.use(
      http.post('/api/tasks', async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.json(
          { task: buildTask({ id: 'n', title: 'New one' }) },
          { status: 201 },
        );
      }),
    );
    await open();
    expect(screen.queryByRole('textbox', { name: /tag/i })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'New task' }), 'New one');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('button', { name: 'Tags for New one' })).toBeDisabled();
    release?.();
  });

  it('search never matches a tag name and the title still does (TAG03 AC-29)', async () => {
    statefulServer(base());
    const sent = recordListQueries();
    await open();
    const box = screen.getByRole('searchbox', { name: 'Search tasks' });
    // "Buy paint" carries the Work tag: the page sends the text alone and shows what comes back.
    await userEvent.type(box, 'Work');
    expect(
      await screen.findByText('No tasks match your search.', {
        selector: 'p.task-list-empty-text',
      }),
    ).toBeInTheDocument();
    expect(sent[sent.length - 1]?.get('search')).toBe('Work');
    expect(sent[sent.length - 1]?.has('tag')).toBe(false);
    await userEvent.clear(box);
    await userEvent.type(box, 'paint');
    await waitFor(() => expect(listedTitles()).toEqual(['Buy paint']));
    expect(sent[sent.length - 1]?.get('search')).toBe('paint');
    expect(sent[sent.length - 1]?.has('tag')).toBe(false);
  });
});
