// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import { TaskRow } from './TaskRow';

function setup(task: Task = buildTask({ id: 't1', title: 'Renew domain' })) {
  const onToggle = vi.fn(() => Promise.resolve(true));
  const onEditTitle = vi.fn(() => Promise.resolve(true));
  const onDelete = vi.fn(() => Promise.resolve(true));
  render(
    <ul>
      <TaskRow task={task} onToggle={onToggle} onEditTitle={onEditTitle} onDelete={onDelete} />
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
