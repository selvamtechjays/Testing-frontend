// tier: component
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildTask } from '../test/builders/task';
import { listedTitles } from '../test/utils';
import { TaskList } from './TaskList';
import { TaskRow } from './TaskRow';

const noop = () => Promise.resolve(true);

function renderRow(task = buildTask()) {
  return render(
    <ul>
      <TaskRow task={task} onToggle={noop} onEditTitle={noop} onDelete={noop} />
    </ul>,
  );
}

describe('TaskRow', () => {
  it('shows a pending task with the word Pending (AC-2 BR-5)', () => {
    renderRow(buildTask({ title: 'Pay hosting invoice', status: 'pending' }));
    expect(screen.getByRole('listitem')).toHaveTextContent('Pay hosting invoice');
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('shows a completed task with the word Completed and a distinct style (AC-2 AC-9 BR-5)', () => {
    renderRow(buildTask({ title: 'Send logo', status: 'completed' }));
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveClass('task-row--completed');
  });

  it('tells the two apart by words, not by colour alone (AC-2)', () => {
    const { unmount } = renderRow(buildTask({ status: 'pending' }));
    const pending = screen.getByRole('listitem').textContent;
    unmount();
    renderRow(buildTask({ status: 'completed' }));
    expect(screen.getByRole('listitem').textContent).not.toBe(pending);
  });

  it('renders an HTML title as plain text and executes nothing (AC-4 TS-12 R-4)', () => {
    const title = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const { container } = renderRow(buildTask({ title }));
    expect(screen.getByRole('listitem')).toHaveTextContent(title);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('offers no description, notes, due date or priority control; only tick, Edit and Delete (AC-8 BR-1 TS-11)', () => {
    renderRow(buildTask());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Edit',
      'Delete',
    ]);
    expect(screen.queryByText(/due|priority|notes|description/i)).not.toBeInTheDocument();
  });
});

describe('TaskList', () => {
  it('keeps every row, completed ones included, in the order given (AC-1 AC-9 AC-11 TS-1)', () => {
    const tasks = [
      buildTask({ id: 'n', title: 'Plan launch', status: 'pending' }),
      buildTask({ id: 'm', title: 'Pay hosting invoice', status: 'pending' }),
      buildTask({ id: 'o', title: 'Send logo', status: 'completed' }),
    ];
    render(<TaskList tasks={tasks} onToggle={noop} onEditTitle={noop} onDelete={noop} />);
    expect(listedTitles()).toEqual(['Plan launch', 'Pay hosting invoice', 'Send logo']);
    expect(screen.getByRole('list', { name: 'Your tasks' })).toBeInTheDocument();
  });
});
