// tier: component
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '../tasks/listFilters';
import { TaskFilterBar } from './TaskFilterBar';

function setup(active = false, filters = DEFAULT_FILTERS) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(<TaskFilterBar filters={filters} onChange={onChange} onClear={onClear} active={active} />);
  return { onChange, onClear };
}

const options = (name: string) =>
  within(screen.getByRole('combobox', { name }))
    .getAllByRole('option')
    .map((o) => o.textContent);

describe('TaskFilterBar', () => {
  it('has four labelled native selects with the plan options (AC-11 AC-15)', () => {
    setup();
    expect(options('Status')).toEqual(['All', 'Pending', 'Completed']);
    expect(options('Priority')).toEqual(['All', 'High', 'Medium', 'Low']);
    expect(options('Due')).toEqual(['Any', 'Overdue', 'Today', 'This week', 'No date']);
    expect(options('Sort')).toEqual(['Newest', 'Due date', 'Priority']);
    expect(screen.getByRole('group', { name: 'Filter and sort tasks' })).toBeInTheDocument();
  });

  it('shows the current choice in each select', () => {
    setup(true, { status: 'completed', priority: 'low', due: 'week', sort: 'due' });
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('completed');
    expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveValue('low');
    expect(screen.getByRole('combobox', { name: 'Due' })).toHaveValue('week');
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveValue('due');
  });

  it.each([
    ['Status', 'pending', 'status'],
    ['Priority', 'high', 'priority'],
    ['Due', 'overdue', 'due'],
    ['Sort', 'priority', 'sort'],
  ])('reports a change of %s straight away (AC-11)', async (name, value, key) => {
    const { onChange } = setup();
    await userEvent.selectOptions(screen.getByRole('combobox', { name }), value);
    expect(onChange).toHaveBeenCalledWith(key, value);
  });

  it('shows Clear filters only while filters are active (AC-11)', () => {
    setup(false);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('Clear filters calls back when clicked or pressed with the keyboard (AC-11 AC-15)', async () => {
    const { onClear } = setup(true);
    const button = screen.getByRole('button', { name: 'Clear filters' });
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it('every control is reachable by Tab in order (AC-15)', async () => {
    setup(true);
    await userEvent.tab();
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toHaveFocus();
  });
});
