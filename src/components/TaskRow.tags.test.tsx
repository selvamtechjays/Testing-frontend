// tier: component
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tag, Task, TaskTag } from '../api/types';
import { buildTask } from '../test/builders/task';
import { buildTag } from '../test/mocks/tags';
import { TaskList } from './TaskList';
import { TaskRow, type RowTags } from './TaskRow';

const noop = () => Promise.resolve(true);
const asTaskTag = ({ id, name, colour }: Tag): TaskTag => ({ id, name, colour });
const home = buildTag({ id: 'h', name: 'Home', colour: 'green' });
const work = buildTag({ id: 'w', name: 'Work', colour: 'blue' });

function rowTags(over: Partial<RowTags> = {}): RowTags {
  return {
    open: false,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    tags: [home, work],
    tagsStatus: 'ready',
    onChangeTags: vi.fn(noop),
    onCreate: vi.fn(() => Promise.resolve({ ok: true })),
    onRetryTags: vi.fn(),
    ...over,
  };
}

function row(task: Task, tags?: RowTags, leaving = false) {
  render(
    <ul>
      <TaskRow
        task={task}
        today="2026-11-16"
        leaving={leaving}
        onToggle={noop}
        onEditTitle={noop}
        onChangeDueDate={noop}
        onChangePriority={noop}
        onDelete={noop}
        tags={tags}
      />
    </ul>,
  );
}

describe('TaskRow tags chips and button (FEAT-TAG-03 AC-5 AC-26 BR-13)', () => {
  it('shows the task tags as chips on the row, name visible (TAG03 AC-5)', () => {
    row(buildTask({ title: 'Buy paint', tags: [asTaskTag(home), asTaskTag(work)] }));
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('shows no chips for a task without tags (TAG03 AC-5)', () => {
    row(buildTask({ title: 'Buy paint' }), rowTags());
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });

  it('has a Tags button named for its task, collapsed by default (TAG03 AC-27)', () => {
    row(buildTask({ title: 'Buy paint' }), rowTags());
    const button = screen.getByRole('button', { name: 'Tags for Buy paint' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
  });

  it('shows no Tags button for a row given no tags control (TAG03 AC-21)', () => {
    row(buildTask({ title: 'Buy paint' }));
    expect(screen.queryByRole('button', { name: /^Tags for/ })).not.toBeInTheDocument();
  });

  it('asks to toggle when pressed (TAG03 AC-27)', async () => {
    const tags = rowTags();
    row(buildTask({ title: 'Buy paint' }), tags);
    await userEvent.click(screen.getByRole('button', { name: 'Tags for Buy paint' }));
    expect(tags.onToggle).toHaveBeenCalledTimes(1);
  });

  it('is expanded and points at the picker while open (TAG03 AC-6)', () => {
    row(buildTask({ id: 't1', title: 'Buy paint' }), rowTags({ open: true }));
    const button = screen.getByRole('button', { name: 'Tags for Buy paint' });
    const panel = screen.getByRole('group', { name: 'Tags panel for Buy paint' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', panel.id);
  });

  it('has its Tags button off while the row is still unsaved (TAG03 AC-26)', () => {
    row(buildTask({ id: 'temp-9', title: 'Not saved yet' }), rowTags());
    expect(screen.getByRole('button', { name: 'Tags for Not saved yet' })).toBeDisabled();
  });

  it('has its Tags button off while the row is leaving (TAG03 AC-26)', () => {
    row(buildTask({ title: 'Going' }), rowTags(), true);
    expect(screen.getByRole('button', { name: 'Tags for Going', hidden: true })).toBeDisabled();
  });

  it('sends the whole new list when a tag is ticked (TAG03 AC-6)', async () => {
    const tags = rowTags({ open: true });
    row(buildTask({ id: 't1', title: 'Buy paint', tags: [asTaskTag(home)] }), tags);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Work' }));
    expect(tags.onChangeTags).toHaveBeenCalledWith('t1', ['h', 'w']);
  });

  it('sends the list without the tag when one is unticked, and an empty list at the last (TAG03 AC-6)', async () => {
    const tags = rowTags({ open: true });
    row(buildTask({ id: 't1', title: 'Buy paint', tags: [asTaskTag(home)] }), tags);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Home' }));
    expect(tags.onChangeTags).toHaveBeenCalledWith('t1', []);
  });

  it('hands the typed name to Create tag with the row id (TAG03 AC-7)', async () => {
    const tags = rowTags({ open: true });
    row(buildTask({ id: 't1', title: 'Buy paint' }), tags);
    await userEvent.type(screen.getByRole('textbox', { name: 'Create tag' }), 'Groceries{Enter}');
    expect(tags.onCreate).toHaveBeenCalledWith('t1', 'Groceries');
  });

  it('Escape inside the picker asks to close it (TAG03 AC-27)', async () => {
    const tags = rowTags({ open: true });
    row(buildTask({ id: 't1', title: 'Buy paint' }), tags);
    await userEvent.keyboard('{Escape}');
    expect(tags.onClose).toHaveBeenCalledTimes(1);
  });
});

const alpha = buildTask({ id: 'a', title: 'Alpha', notes: 'Alpha notes' });
const bravo = buildTask({ id: 'b', title: 'Bravo' });

function renderList(tasks: Task[]) {
  render(
    <TaskList
      tasks={tasks}
      today="2026-11-16"
      onToggle={noop}
      onEditTitle={noop}
      onChangeDueDate={noop}
      onChangePriority={noop}
      onChangeNotes={noop}
      onDelete={noop}
      tags={[home, work]}
      tagsStatus="ready"
      onChangeTags={noop}
      onCreateTag={() => Promise.resolve({ ok: true })}
      onRetryTags={() => undefined}
    />,
  );
}

const press = (name: string) => userEvent.click(screen.getByRole('button', { name }));

describe('TaskList keeps one row panel open (FEAT-TAG-03 AC-27 ASM-070)', () => {
  it('opening the picker closes an open notes panel and the reverse (TAG03 AC-27)', async () => {
    renderList([alpha, bravo]);
    await press('Notes for Alpha');
    expect(screen.getByRole('textbox', { name: 'Notes for Alpha' })).toBeInTheDocument();
    await press('Tags for Bravo');
    expect(screen.queryByRole('textbox', { name: 'Notes for Alpha' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tags panel for Bravo' })).toBeInTheDocument();
    await press('Notes for Alpha');
    expect(screen.queryByRole('group', { name: 'Tags panel for Bravo' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Notes for Alpha' })).toBeInTheDocument();
  });

  it('opens one picker at a time and closes it from its own button (TAG03 AC-27)', async () => {
    renderList([alpha, bravo]);
    await press('Tags for Alpha');
    await press('Tags for Bravo');
    expect(screen.getAllByRole('group', { name: /^Tags panel for/ })).toHaveLength(1);
    await press('Tags for Bravo');
    expect(screen.queryByRole('group', { name: /^Tags panel for/ })).not.toBeInTheDocument();
  });

  it('Escape closes the picker and returns focus to that row Tags button (TAG03 AC-27)', async () => {
    renderList([alpha]);
    await press('Tags for Alpha');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: /^Tags panel for/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tags for Alpha' })).toHaveFocus();
  });

  it('switching from a dirty notes panel to the picker shows the not-saved line (TAG03 AC-27)', async () => {
    renderList([alpha, bravo]);
    await press('Notes for Alpha');
    await userEvent.type(screen.getByRole('textbox', { name: 'Notes for Alpha' }), '!');
    await press('Tags for Bravo');
    expect(screen.getByText('Your changes to the notes were not saved.')).toBeInTheDocument();
  });

  it('a clean notes panel closed by the picker shows no line (TAG03 AC-27)', async () => {
    renderList([alpha, bravo]);
    await press('Notes for Alpha');
    await press('Tags for Bravo');
    expect(screen.queryByText(/were not saved/)).not.toBeInTheDocument();
    // One row panel: the picker (its own checkbox group is inside it and is not a panel).
    expect(
      within(screen.getByRole('list')).queryAllByRole('group', { name: /^(Tags|Notes) panel for/ }),
    ).toHaveLength(1);
  });
});

describe('TaskRow chips as filters (FEAT-TAG-04 AC-7 AC-22 BR-10)', () => {
  it('makes the chips of a saved row buttons that report the tag chosen (TAG04 AC-22)', async () => {
    const onSelect = vi.fn();
    row(
      buildTask({ id: 't1', title: 'Buy paint', tags: [asTaskTag(home)] }),
      rowTags({ onSelect }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onSelect).toHaveBeenCalledWith('h');
  });

  it('keeps the chips of a row that is not saved yet as plain text (TAG04 AC-22)', () => {
    row(
      buildTask({ id: 'temp-1', title: 'Not saved', tags: [asTaskTag(home)] }),
      rowTags({ onSelect: vi.fn() }),
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('keeps the chips of a row that is leaving as plain text (TAG04 AC-22)', () => {
    row(
      buildTask({ id: 't2', title: 'Going', tags: [asTaskTag(home)] }),
      rowTags({ onSelect: vi.fn() }),
      true,
    );
    expect(screen.queryByRole('button', { name: 'Home', hidden: true })).not.toBeInTheDocument();
  });

  it('keeps the chips plain when the list gives no way to choose one (TAG04 AC-22)', () => {
    row(buildTask({ id: 't3', title: 'Plain', tags: [asTaskTag(home)] }), rowTags());
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
  });
});
