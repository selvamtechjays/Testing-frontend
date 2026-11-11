// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import { TaskRow } from './TaskRow';

function setup(task: Task) {
  const onDelete = vi.fn(() => Promise.resolve(true));
  const noop = () => Promise.resolve(true);
  render(
    <ul>
      <TaskRow task={task} onToggle={noop} onEditTitle={noop} onDelete={onDelete} />
    </ul>,
  );
  return { onDelete };
}

describe('TaskRow delete control', () => {
  it('has a delete button named for the task on a Pending row (AC-1)', () => {
    setup(buildTask({ id: 't1', title: 'Old idea', status: 'pending' }));
    expect(screen.getByRole('button', { name: 'Delete Old idea' })).toBeInTheDocument();
  });

  it('has the same delete button on a Completed row (AC-4 BR-1)', () => {
    setup(buildTask({ id: 't1', title: 'Send logo', status: 'completed' }));
    expect(screen.getByRole('button', { name: 'Delete Send logo' })).toBeInTheDocument();
  });

  it('asks to delete that task on one click, with no confirmation dialog (AC-1 BR-1 TS-1)', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { onDelete } = setup(buildTask({ id: 't1', title: 'Old idea' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Old idea' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('t1');
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('can be reached and activated with the keyboard alone (NFR accessibility)', async () => {
    const { onDelete } = setup(buildTask({ id: 't1', title: 'Old idea' }));
    await userEvent.tab(); // tick
    await userEvent.tab(); // Edit
    await userEvent.tab(); // Delete
    expect(screen.getByRole('button', { name: 'Delete Old idea' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onDelete).toHaveBeenCalledWith('t1');
  });

  it('is disabled while its add is still unsaved (R-3)', async () => {
    const { onDelete } = setup(buildTask({ id: 'temp-2', title: 'Not saved yet' }));
    const button = screen.getByRole('button', { name: 'Delete Not saved yet' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('is not offered while the title is being edited (AC-1)', async () => {
    setup(buildTask({ id: 't1', title: 'Old idea' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('button', { name: 'Delete Old idea' })).not.toBeInTheDocument();
  });
});
