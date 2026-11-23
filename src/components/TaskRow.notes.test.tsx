// tier: component
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import { TaskList } from './TaskList';
import { TaskRow, type RowNotes } from './TaskRow';

const noop = () => Promise.resolve(true);
const NOT_SAVED = 'Your changes to the notes were not saved.';

function row(task: Task, notes?: Partial<RowNotes>) {
  const handlers: RowNotes = {
    open: false,
    onToggle: vi.fn(),
    onChange: vi.fn(noop),
    onClose: vi.fn(),
    onDirtyChange: vi.fn(),
    ...notes,
  };
  render(
    <ul>
      <TaskRow
        task={task}
        today="2026-11-16"
        onToggle={noop}
        onEditTitle={noop}
        onChangeDueDate={noop}
        onChangePriority={noop}
        onDelete={noop}
        notes={handlers}
      />
    </ul>,
  );
  return handlers;
}

describe('TaskRow notes indicator and button (AC-6)', () => {
  it('shows "Has notes" for a task with notes (AC-6)', () => {
    row(buildTask({ title: 'Buy paint', notes: 'Call Ravi' }));
    expect(screen.getByText('Has notes')).toBeInTheDocument();
  });

  it('shows nothing extra for a task without notes (AC-6)', () => {
    row(buildTask({ title: 'Buy paint', notes: null }));
    expect(screen.queryByText('Has notes')).not.toBeInTheDocument();
  });

  it('shows the label for a stored task even in a row given no notes control', () => {
    render(
      <ul>
        <TaskRow
          task={buildTask({ title: 'Buy paint', notes: 'x' })}
          today="2026-11-16"
          onToggle={noop}
          onEditTitle={noop}
          onChangeDueDate={noop}
          onChangePriority={noop}
          onDelete={noop}
        />
      </ul>,
    );
    expect(screen.getByText('Has notes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Notes for/ })).not.toBeInTheDocument();
  });

  it('has a Notes button named for its task, collapsed by default (AC-10)', () => {
    row(buildTask({ title: 'Buy paint' }));
    const button = screen.getByRole('button', { name: 'Notes for Buy paint' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
  });

  it('asks to toggle when pressed (AC-8)', async () => {
    const { onToggle } = row(buildTask({ title: 'Buy paint' }));
    await userEvent.click(screen.getByRole('button', { name: 'Notes for Buy paint' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is expanded and points at the panel while open (AC-10)', () => {
    row(buildTask({ id: 't1', title: 'Buy paint', notes: 'Call Ravi' }), { open: true });
    const button = screen.getByRole('button', { name: 'Notes for Buy paint' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('group', { name: 'Notes panel for Buy paint' });
    expect(button).toHaveAttribute('aria-controls', panel.id);
    expect(within(panel).getByRole('textbox')).toHaveValue('Call Ravi');
  });

  it('is disabled while the row is still unsaved (R-5)', () => {
    row(buildTask({ id: 'temp-4', title: 'Not saved yet' }));
    expect(screen.getByRole('button', { name: 'Notes for Not saved yet' })).toBeDisabled();
  });

  it('is disabled while the row is leaving the list', () => {
    render(
      <ul>
        <TaskRow
          task={buildTask({ title: 'Going' })}
          today="2026-11-16"
          leaving
          onToggle={noop}
          onEditTitle={noop}
          onChangeDueDate={noop}
          onChangePriority={noop}
          onDelete={noop}
          notes={{
            open: false,
            onToggle: vi.fn(),
            onChange: noop,
            onClose: vi.fn(),
            onDirtyChange: vi.fn(),
          }}
        />
      </ul>,
    );
    expect(screen.getByRole('button', { name: 'Notes for Going', hidden: true })).toBeDisabled();
  });

  it('saving from the panel sends the change and closes it clean (AC-7)', async () => {
    const { onChange, onClose } = row(buildTask({ id: 't1', title: 'Buy paint', notes: null }), {
      open: true,
    });
    await userEvent.type(screen.getByRole('textbox', { name: 'Notes for Buy paint' }), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChange).toHaveBeenCalledWith('t1', 'Hi');
    expect(onClose).toHaveBeenCalledWith(false);
  });
});

function renderList(tasks: Task[], onChangeNotes = vi.fn(noop)) {
  const props = {
    today: '2026-11-16',
    onToggle: noop,
    onEditTitle: noop,
    onChangeDueDate: noop,
    onChangePriority: noop,
    onChangeNotes,
    onDelete: noop,
    tags: [],
    tagsStatus: 'ready' as const,
    onChangeTags: noop,
    onCreateTag: () => Promise.resolve({ ok: true }),
    onRetryTags: () => undefined,
  };
  const view = render(<TaskList tasks={tasks} {...props} />);
  return {
    onChangeNotes,
    rerender: (next: Task[]) => view.rerender(<TaskList tasks={next} {...props} />),
  };
}

const alpha = buildTask({ id: 'a', title: 'Alpha', notes: 'Alpha notes' });
const bravo = buildTask({ id: 'b', title: 'Bravo', notes: null });
const openNotes = (title: string) =>
  userEvent.click(screen.getByRole('button', { name: `Notes for ${title}` }));
const box = (title: string) => screen.getByRole('textbox', { name: `Notes for ${title}` });

describe('TaskList notes panels (AC-8)', () => {
  it('opens one panel at a time (AC-8)', async () => {
    renderList([alpha, bravo]);
    await openNotes('Alpha');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    await openNotes('Bravo');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(box('Bravo')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Notes for Alpha' })).not.toBeInTheDocument();
  });

  it('switching rows with an unsaved change discards it and shows the not-saved line (AC-8 DEC-238)', async () => {
    const { onChangeNotes } = renderList([alpha, bravo]);
    await openNotes('Alpha');
    await userEvent.type(box('Alpha'), ' more');
    await openNotes('Bravo');
    expect(screen.getByText(NOT_SAVED)).toBeInTheDocument();
    expect(onChangeNotes).not.toHaveBeenCalled();
  });

  it('switching rows with a clean box shows no line (AC-8)', async () => {
    renderList([alpha, bravo]);
    await openNotes('Alpha');
    await openNotes('Bravo');
    expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument();
  });

  it('Escape with a typed change closes the panel and shows the line, announced politely (AC-8 AC-10)', async () => {
    renderList([alpha, bravo]);
    await openNotes('Alpha');
    await userEvent.type(box('Alpha'), '!');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const line = screen.getByText(NOT_SAVED);
    expect(line).toHaveAttribute('aria-live', 'polite');
  });

  it('Escape on an untouched panel closes it silently (AC-8)', async () => {
    renderList([alpha]);
    await openNotes('Alpha');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument();
  });

  it('Cancel with a typed change shows the line (AC-8)', async () => {
    renderList([alpha]);
    await openNotes('Alpha');
    await userEvent.type(box('Alpha'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(NOT_SAVED)).toBeInTheDocument();
  });

  it('opening any panel clears the line (AC-8)', async () => {
    renderList([alpha, bravo]);
    await openNotes('Alpha');
    await userEvent.type(box('Alpha'), 'x');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText(NOT_SAVED)).toBeInTheDocument();
    await openNotes('Bravo');
    expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument();
  });

  it('pressing Notes on the open row closes it as Cancel does, with the line if dirty (AC-8)', async () => {
    renderList([alpha]);
    await openNotes('Alpha');
    await userEvent.type(box('Alpha'), 'x');
    await openNotes('Alpha');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(NOT_SAVED)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes for Alpha' })).toHaveFocus();
  });

  it('a dirty row leaving the list closes its panel and shows the line (AC-8 DEC-238)', async () => {
    const { rerender } = renderList([alpha, bravo]);
    await openNotes('Alpha');
    await userEvent.type(box('Alpha'), 'x');
    rerender([bravo]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(NOT_SAVED)).toBeInTheDocument();
  });

  it('a clean row leaving the list closes its panel silently (AC-8)', async () => {
    const { rerender } = renderList([alpha, bravo]);
    await openNotes('Alpha');
    rerender([bravo]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(NOT_SAVED)).not.toBeInTheDocument();
  });

  it('Save sends the change, closes the panel and returns focus to that row Notes button (AC-7 DEC-239)', async () => {
    const { onChangeNotes } = renderList([alpha, bravo]);
    await openNotes('Bravo');
    await userEvent.type(box('Bravo'), 'Buy two tins');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChangeNotes).toHaveBeenCalledWith('b', 'Buy two tins');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes for Bravo' })).toHaveFocus();
  });

  it('a confirmed Clear notes sends null and returns focus the same way (AC-2 DEC-239)', async () => {
    const { onChangeNotes } = renderList([alpha]);
    await openNotes('Alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear notes' }));
    expect(onChangeNotes).toHaveBeenCalledWith('a', null);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes for Alpha' })).toHaveFocus();
  });

  it('Save with nothing changed closes without a request (DEC-242)', async () => {
    const { onChangeNotes } = renderList([alpha]);
    await openNotes('Alpha');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChangeNotes).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('can be opened, edited and closed with the keyboard alone (AC-10)', async () => {
    renderList([bravo]);
    const button = screen.getByRole('button', { name: 'Notes for Bravo' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(box('Bravo')).toHaveFocus();
    await userEvent.keyboard('Hello');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Notes for Bravo' })).toHaveFocus();
  });
});
