// tier: component
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { copy } from '../copy';
import { TaskListEmpty, TaskListLoading } from './TaskListStates';

describe('task list states (ui-standards §6)', () => {
  it('loading shows the word and busy placeholders hidden from assistive tech', () => {
    const { container } = render(<TaskListLoading />);
    expect(screen.getByText(copy.tasksLoading)).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.task-list-skeleton[aria-hidden="true"]')).toHaveLength(3);
  });

  it('empty is a designed state: a decorative illustration and the pointer to Add', () => {
    const { container } = render(<TaskListEmpty />);
    expect(screen.getByText(copy.tasksEmpty)).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
