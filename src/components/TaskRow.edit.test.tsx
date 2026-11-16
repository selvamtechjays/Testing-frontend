// tier: component
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import { TaskRow } from './TaskRow';

const noop = () => Promise.resolve(true);

function setup(task: Task = buildTask({ id: 't1', title: 'Renew domain' })) {
  const onToggle = vi.fn(() => Promise.resolve(true));
  const onEditTitle = vi.fn(() => Promise.resolve(true));
  const onDelete = vi.fn(() => Promise.resolve(true));
  render(
    <ul>
      <TaskRow
        task={task}
        today="2026-11-16"
        onToggle={onToggle}
        onEditTitle={onEditTitle}
        onChangeDueDate={noop}
        onChangePriority={noop}
        onDelete={onDelete}
      />
    </ul>,
  );
  return { onToggle, onEditTitle, onDelete, task };
}

const editInput = () => screen.getByRole('textbox', { name: 'Edit title' });
const startEdit = () => userEvent.click(screen.getByRole('button', { name: 'Edit' }));

describe('TaskRow tick control', () => {
  it('is an unchecked, labelled checkbox for a Pending task (AC-1 BR-3)', () => {
    setup(buildTask({ id: 't1', title: 'Pay hosting invoice' }));
    const box = screen.getByRole('checkbox', { name: 'Mark Pay hosting invoice as completed' });
    expect(box).not.toBeChecked();
  });

  it('is checked for a Completed task, which also reads Completed (AC-2 AC-10)', () => {
    setup(buildTask({ id: 't1', title: 'Send logo', status: 'completed' }));
    expect(screen.getByRole('checkbox', { name: 'Mark Send logo as not completed' })).toBeChecked();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('asks to toggle that task when clicked (AC-1 AC-2 TS-1 TS-2)', async () => {
    const { onToggle } = setup(buildTask({ id: 't1' }));
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('can be reached and toggled with the keyboard alone (NFR accessibility)', async () => {
    const { onToggle } = setup(buildTask({ id: 't1' }));
    await userEvent.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('ignores the tick and Edit while its add is still unsaved (R-5)', async () => {
    const { onToggle } = setup(buildTask({ id: 'temp-4', title: 'Not saved yet' }));
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('TaskRow title edit', () => {
  it('opens an input pre-filled with the title, focused and selected (AC-3)', async () => {
    setup();
    await startEdit();
    expect(editInput()).toHaveValue('Renew domain');
    expect(editInput()).toHaveFocus();
    await userEvent.keyboard('X');
    expect(editInput()).toHaveValue('X');
  });

  it('saves the trimmed new title with Save and returns focus to Edit (AC-3 TS-3)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.type(editInput(), '  Renew brightleaf domain ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onEditTitle).toHaveBeenCalledWith('t1', 'Renew brightleaf domain');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
  });

  it('saves with Enter (AC-3)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.type(editInput(), ' two{Enter}');
    expect(onEditTitle).toHaveBeenCalledWith('t1', 'Renew domain two');
  });

  it('discards the draft on Cancel with no call (AC-3)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.type(editInput(), ' changed');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onEditTitle).not.toHaveBeenCalled();
    expect(screen.getByText('Renew domain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
  });

  it('discards the draft on Escape with no call (AC-3)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.type(editInput(), ' changed{Escape}');
    expect(onEditTitle).not.toHaveBeenCalled();
    expect(screen.getByText('Renew domain')).toBeInTheDocument();
  });

  it('closes without a call when the title is unchanged (AC-3)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onEditTitle).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('refuses an empty title with a message, stays in edit mode and keeps the old title (AC-5 BR-1 TS-7)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onEditTitle).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title.');
    expect(editInput()).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Renew domain')).toBeInTheDocument();
  });

  it('refuses a title of only spaces the same way (AC-5 OQ-TASK-01)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.type(editInput(), '   {Enter}');
    expect(onEditTitle).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title.');
  });

  it('accepts a title of exactly 200 characters (AC-4 BR-2 TS-4)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.paste('k'.repeat(200));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(onEditTitle).toHaveBeenCalledWith('t1', 'k'.repeat(200));
  });

  it('accepts a 1-character title (AC-3 TS-5)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.type(editInput(), 'x{Enter}');
    expect(onEditTitle).toHaveBeenCalledWith('t1', 'x');
  });

  it('stops a paste at 200 characters and shows the limit message (AC-6 BR-2 TS-8)', async () => {
    setup();
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.paste('p'.repeat(250));
    expect(editInput()).toHaveValue('p'.repeat(200));
    expect(screen.getByRole('alert')).toHaveTextContent('Titles can be at most 200 characters.');
  });

  it('clears the limit message once the text is under the limit again (AC-6)', async () => {
    setup();
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.paste('p'.repeat(250));
    await userEvent.keyboard('{Backspace}');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps emoji, accents and CJK exactly as typed (AC-3 TS-6)', async () => {
    const { onEditTitle } = setup();
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.paste('Plan 🚀 café 計画');
    await userEvent.keyboard('{Enter}');
    expect(onEditTitle).toHaveBeenCalledWith('t1', 'Plan 🚀 café 計画');
  });

  it('shows an edited HTML title as plain text and executes nothing (AC-3 TS-11)', async () => {
    const html = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    function Harness() {
      const [task, setTask] = useState(buildTask({ id: 't1', title: 'Before' }));
      return (
        <ul>
          <TaskRow
            task={task}
            today="2026-11-16"
            onChangeDueDate={() => Promise.resolve(true)}
            onChangePriority={() => Promise.resolve(true)}
            onToggle={() => Promise.resolve(true)}
            onDelete={() => Promise.resolve(true)}
            onEditTitle={(_, title) => {
              setTask({ ...task, title });
              return Promise.resolve(true);
            }}
          />
        </ul>
      );
    }
    const { container } = render(<Harness />);
    await startEdit();
    await userEvent.clear(editInput());
    await userEvent.paste(html);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('listitem')).toHaveTextContent(html);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('edits and saves by keyboard alone (NFR accessibility)', async () => {
    const { onEditTitle } = setup();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(editInput()).toHaveFocus();
    await userEvent.type(editInput(), '!{Enter}');
    expect(onEditTitle).toHaveBeenCalledWith('t1', 'Renew domain!');
  });
});

describe('TaskRow due date and priority (Task-23)', () => {
  const TODAY = '2026-11-16';

  function setupDated(task: Task) {
    const onChangeDueDate = vi.fn(() => Promise.resolve(true));
    const onChangePriority = vi.fn(() => Promise.resolve(true));
    const noop = () => Promise.resolve(true);
    render(
      <ul>
        <TaskRow
          task={task}
          today={TODAY}
          onToggle={noop}
          onEditTitle={noop}
          onChangeDueDate={onChangeDueDate}
          onChangePriority={onChangePriority}
          onDelete={noop}
        />
      </ul>,
    );
    return { onChangeDueDate, onChangePriority };
  }

  it('shows the priority as a word on every row (AC-10)', () => {
    setupDated(buildTask({ priority: 'high' }));
    expect(screen.getByText('High priority')).toBeInTheDocument();
  });

  it('says Overdue for a pending task past its date (AC-10)', () => {
    setupDated(buildTask({ status: 'pending', dueDate: '2026-11-10' }));
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('never says Overdue for a completed task, and shows its date instead (AC-10)', () => {
    setupDated(buildTask({ status: 'completed', dueDate: '2026-11-10' }));
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.getByText('Due Nov 10, 2026')).toBeInTheDocument();
  });

  it('says Due today for a task due today (AC-10)', () => {
    setupDated(buildTask({ dueDate: TODAY }));
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('shows the stored day for a later date with no shifting (AC-9)', () => {
    setupDated(buildTask({ dueDate: '2026-11-20' }));
    expect(screen.getByText('Due Nov 20, 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Due date for Task', { exact: false })).toHaveValue('2026-11-20');
  });

  it('shows no due text for a task without a date', () => {
    setupDated(buildTask({ dueDate: null }));
    expect(screen.queryByText(/^Due /)).not.toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });

  it('saves a full date once the box is left, not while it is typed (AC-14)', () => {
    const task = buildTask({ id: 't9', title: 'Pay rent', dueDate: null });
    const { onChangeDueDate } = setupDated(task);
    const box = screen.getByLabelText('Due date for Pay rent');
    fireEvent.change(box, { target: { value: '0002-11-25' } });
    fireEvent.change(box, { target: { value: '0020-11-25' } });
    fireEvent.change(box, { target: { value: '2026-11-25' } });
    expect(onChangeDueDate).not.toHaveBeenCalled();
    fireEvent.blur(box);
    expect(onChangeDueDate).toHaveBeenCalledTimes(1);
    expect(onChangeDueDate).toHaveBeenCalledWith('t9', '2026-11-25');
  });

  it('refuses a date past the five-year limit with a linked message and saves nothing (REV-ERR-0e8afdf9)', () => {
    const task = buildTask({ id: 't9', title: 'Pay rent', dueDate: '2026-11-25' });
    const { onChangeDueDate } = setupDated(task);
    const box = screen.getByLabelText('Due date for Pay rent');
    fireEvent.change(box, { target: { value: '2031-11-17' } });
    fireEvent.blur(box);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('A due date can be at most five years ahead.');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAttribute('aria-describedby', alert.id);
    expect(onChangeDueDate).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: '2031-11-16' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.blur(box);
    expect(onChangeDueDate).toHaveBeenCalledWith('t9', '2031-11-16');
  });

  it('drops the too-far message when the stored date changes underneath it, as with Clear date (REV-CORR-e5cac55f)', async () => {
    function Stateful() {
      const [task, setTask] = useState(
        buildTask({ id: 't9', title: 'Pay rent', dueDate: '2026-11-25' }),
      );
      return (
        <ul>
          <TaskRow
            task={task}
            today={TODAY}
            onToggle={noop}
            onEditTitle={noop}
            onChangeDueDate={(_id, dueDate) => {
              setTask({ ...task, dueDate });
              return Promise.resolve(true);
            }}
            onChangePriority={noop}
            onDelete={noop}
          />
        </ul>
      );
    }
    render(<Stateful />);
    const box = screen.getByLabelText('Due date for Pay rent');
    fireEvent.change(box, { target: { value: '2031-11-17' } });
    fireEvent.blur(box);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear date for Pay rent' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(box).toHaveValue('');
    expect(box).not.toHaveAttribute('aria-invalid');
  });

  it('caps the row date at five years from the today it is given (DEC-211)', () => {
    setupDated(buildTask({ title: 'Pay rent' }));
    expect(screen.getByLabelText('Due date for Pay rent')).toHaveAttribute('max', '2031-11-16');
  });

  it('saves a full date on Enter (AC-14 AC-15)', () => {
    const task = buildTask({ id: 't9', title: 'Pay rent', dueDate: null });
    const { onChangeDueDate } = setupDated(task);
    const box = screen.getByLabelText('Due date for Pay rent');
    fireEvent.change(box, { target: { value: '2026-11-25' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onChangeDueDate).toHaveBeenCalledWith('t9', '2026-11-25');
  });

  it('puts the stored date back when the box is left half-typed or emptied (AC-3 AC-14)', () => {
    const task = buildTask({ id: 't9', title: 'Pay rent', dueDate: '2026-11-25' });
    const { onChangeDueDate } = setupDated(task);
    const box = screen.getByLabelText('Due date for Pay rent');
    fireEvent.change(box, { target: { value: '0002-11-25' } });
    fireEvent.blur(box);
    expect(box).toHaveValue('2026-11-25');
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.blur(box);
    expect(box).toHaveValue('2026-11-25');
    expect(onChangeDueDate).not.toHaveBeenCalled();
  });

  it('clears the date with Clear date, which is off when there is no date (AC-3 AC-14)', async () => {
    const task = buildTask({ id: 't9', title: 'Pay rent', dueDate: '2026-11-25' });
    const { onChangeDueDate } = setupDated(task);
    await userEvent.click(screen.getByRole('button', { name: 'Clear date for Pay rent' }));
    expect(onChangeDueDate).toHaveBeenCalledWith('t9', null);
  });

  it('disables Clear date when the task has no date', () => {
    setupDated(buildTask({ title: 'Pay rent', dueDate: null }));
    expect(screen.getByRole('button', { name: 'Clear date for Pay rent' })).toBeDisabled();
  });

  it('changes the priority the moment it is picked (AC-14)', async () => {
    const task = buildTask({ id: 't9', title: 'Pay rent', priority: 'medium' });
    const { onChangePriority } = setupDated(task);
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Priority for Pay rent' }),
      'low',
    );
    expect(onChangePriority).toHaveBeenCalledWith('t9', 'low');
  });

  it('is operable by keyboard: Tab reaches the date, Clear date and priority (AC-15)', async () => {
    setupDated(buildTask({ title: 'Pay rent', dueDate: '2026-11-25' }));
    await userEvent.tab(); // checkbox
    await userEvent.tab(); // Edit
    await userEvent.tab(); // Delete
    await userEvent.tab(); // date input
    expect(screen.getByLabelText('Due date for Pay rent')).toHaveFocus();
    await userEvent.tab(); // Clear date
    await userEvent.tab();
    expect(screen.getByRole('combobox', { name: 'Priority for Pay rent' })).toHaveFocus();
  });

  it('turns the controls off while the add is unsaved', () => {
    setupDated(buildTask({ id: 'temp-1', title: 'Pay rent' }));
    expect(screen.getByLabelText('Due date for Pay rent')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Priority for Pay rent' })).toBeDisabled();
  });
});
