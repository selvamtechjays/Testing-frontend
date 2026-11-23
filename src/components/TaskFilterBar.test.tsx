// tier: component
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tag } from '../api/types';
import { DEFAULT_FILTERS } from '../tasks/listFilters';
import { buildTag } from '../test/mocks/tags';
import { TaskFilterBar } from './TaskFilterBar';

function setup(
  active = false,
  filters = DEFAULT_FILTERS,
  tags: Tag[] = [],
  manage?: { open: boolean; onToggle: () => void },
) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(
    <TaskFilterBar
      filters={filters}
      onChange={onChange}
      onClear={onClear}
      active={active}
      tags={tags}
      manage={manage}
    />,
  );
  return { onChange, onClear };
}

const options = (name: string) =>
  within(screen.getByRole('combobox', { name }))
    .getAllByRole('option')
    .map((o) => o.textContent);

describe('TaskFilterBar', () => {
  it('has five labelled native selects with the plan options (AC-11 AC-15)', () => {
    setup();
    expect(options('Status')).toEqual(['All', 'Pending', 'Completed']);
    expect(options('Priority')).toEqual(['All', 'High', 'Medium', 'Low']);
    expect(options('Due')).toEqual(['Any', 'Overdue', 'Today', 'This week', 'No date']);
    expect(options('Sort')).toEqual(['Newest', 'Due date', 'Priority']);
    expect(options('Tag')).toEqual(['Any', 'No tags']);
    expect(screen.getByRole('group', { name: 'Filter and sort tasks' })).toBeInTheDocument();
  });

  it('shows the current choice in each select', () => {
    setup(true, { status: 'completed', priority: 'low', due: 'week', sort: 'due', tag: 'none' });
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('completed');
    expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveValue('low');
    expect(screen.getByRole('combobox', { name: 'Due' })).toHaveValue('week');
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveValue('due');
    expect(screen.getByRole('combobox', { name: 'Tag' })).toHaveValue('none');
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

  it('offers Any, No tags and each tag by name, and reports a pick at once (TAG04 AC-4)', async () => {
    const tags = [buildTag({ id: 'e', name: 'Errands' }), buildTag({ id: 'w', name: 'Work' })];
    const { onChange } = setup(false, DEFAULT_FILTERS, tags);
    expect(options('Tag')).toEqual(['Any', 'No tags', 'Errands', 'Work']);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), 'w');
    expect(onChange).toHaveBeenCalledWith('tag', 'w');
  });

  it('shows only Any and No tags for a user with no tags (TAG04 AC-20)', () => {
    setup();
    expect(options('Tag')).toEqual(['Any', 'No tags']);
  });

  it('shows a tag name made of markup as literal text in the select (TAG04 AC-4)', () => {
    const name = '<img src=x onerror=alert(1)>';
    setup(false, DEFAULT_FILTERS, [buildTag({ id: 'm', name })]);
    expect(options('Tag')).toContain(name);
  });

  it('shows a Manage tags button that reports a press and says whether the panel is open (TAG02 AC-1)', async () => {
    const onToggle = vi.fn();
    setup(false, DEFAULT_FILTERS, [], { open: false, onToggle });
    const button = screen.getByRole('button', { name: 'Manage tags' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('points the open Manage tags button at the panel (TAG02 AC-20)', () => {
    setup(false, DEFAULT_FILTERS, [], { open: true, onToggle: vi.fn() });
    const button = screen.getByRole('button', { name: 'Manage tags' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'manage-tags-panel');
  });

  it('shows no Manage tags button when the page offers none (TAG02 AC-1)', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Manage tags' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('combobox', { name: 'Tag' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toHaveFocus();
  });
});
