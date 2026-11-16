// tier: component
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddTaskForm } from './AddTaskForm';

const TODAY = '2026-11-16';

function setup() {
  const onAdd = vi.fn();
  render(<AddTaskForm onAdd={onAdd} today={TODAY} />);
  return { onAdd, input: screen.getByLabelText('New task') };
}

describe('AddTaskForm', () => {
  it('adds on Enter with the trimmed title, clears the field and keeps focus (AC-4 TS-3)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, '  Send brand colours to Techjays {Enter}');
    expect(onAdd).toHaveBeenCalledWith({
      title: 'Send brand colours to Techjays',
      priority: 'medium',
    });
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('adds when the Add button is clicked instead (AC-4 TS-4)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, 'Buy milk');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith({ title: 'Buy milk', priority: 'medium' });
  });

  it('adds nothing for an empty title and sends no request (AC-6 BR-1 TS-8)', async () => {
    const { onAdd } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('adds nothing for a title of only spaces (AC-6 DEC-062)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, '    {Enter}');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('accepts a title of exactly 200 characters in full with no message (AC-5 BR-2 TS-6)', async () => {
    const { onAdd, input } = setup();
    await userEvent.click(input);
    await userEvent.paste('z'.repeat(200));
    expect(input).toHaveValue('z'.repeat(200));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledWith({ title: 'z'.repeat(200), priority: 'medium' });
  });

  it('stops a paste at 200 characters and shows the limit message (AC-7 BR-2 TS-9)', async () => {
    const { input } = setup();
    await userEvent.click(input);
    await userEvent.paste('p'.repeat(250));
    expect(input).toHaveValue('p'.repeat(200));
    expect(screen.getByRole('alert')).toHaveTextContent('Titles can be at most 200 characters.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('refuses a 201st typed character and shows the limit message (AC-7 TS-10)', async () => {
    const { input } = setup();
    await userEvent.click(input);
    await userEvent.paste('q'.repeat(200));
    await userEvent.keyboard('r');
    expect(input).toHaveValue('q'.repeat(200));
    expect(screen.getByRole('alert')).toHaveTextContent('Titles can be at most 200 characters.');
  });

  it('clears the limit message once the title is added (AC-7)', async () => {
    const { input } = setup();
    await userEvent.click(input);
    await userEvent.paste('p'.repeat(250));
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has one labelled text field and one Add button, nothing for notes or description (AC-8 BR-1 TS-11)', () => {
    setup();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(/notes|description/i)).not.toBeInTheDocument();
  });

  it('is operable by keyboard alone (NFR accessibility)', async () => {
    const { onAdd, input } = setup();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.keyboard('Plan launch');
    await userEvent.tab(); // due date
    expect(screen.getByLabelText('Due date')).toHaveFocus();
    await userEvent.tab(); // priority
    expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledWith({ title: 'Plan launch', priority: 'medium' });
  });
});

describe('AddTaskForm due date and priority (Task-23)', () => {
  it('has a labelled date input and a priority select with Medium preselected (AC-1 AC-15)', () => {
    setup();
    expect(screen.getByLabelText('Due date')).toHaveAttribute('type', 'date');
    const priority = screen.getByRole('combobox', { name: 'Priority' });
    expect(priority).toHaveValue('medium');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Low',
      'Medium',
      'High',
    ]);
  });

  it('caps the date picker at five years from the local today (DEC-211)', () => {
    setup();
    const max = screen.getByLabelText('Due date').getAttribute('max') ?? '';
    expect(max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(max).toBe('2031-11-16');
  });

  it('follows the today it is given, so the cap moves when the day does (DEC-211)', () => {
    const { rerender } = render(<AddTaskForm onAdd={vi.fn()} today="2026-12-31" />);
    expect(screen.getByLabelText('Due date')).toHaveAttribute('max', '2031-12-31');
    rerender(<AddTaskForm onAdd={vi.fn()} today="2027-01-01" />);
    expect(screen.getByLabelText('Due date')).toHaveAttribute('max', '2032-01-01');
  });

  it('refuses a typed date past the five-year limit with a linked message and adds nothing (REV-ERR-0e8afdf9)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, 'Far away');
    const date = screen.getByLabelText('Due date');
    fireEvent.change(date, { target: { value: '2031-11-17' } });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('A due date can be at most five years ahead.');
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(date).toHaveAttribute('aria-describedby', alert.id);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(input).toHaveValue('Far away');
  });

  it('refuses a half-typed date with a linked message and adds nothing (REV-CORR-e297b993)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, 'Half way');
    const date = screen.getByLabelText('Due date') as HTMLInputElement;
    // jsdom cannot produce a half-typed date, so the box reports one.
    Object.defineProperty(date, 'validity', { value: { badInput: true }, configurable: true });
    await userEvent.type(input, '{Enter}');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter the whole date, or clear it.');
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(date).toHaveAttribute('aria-describedby', alert.id);
    expect(onAdd).not.toHaveBeenCalled();
    expect(input).toHaveValue('Half way');
    // Typing in the date box again clears the message.
    fireEvent.change(date, { target: { value: '2026-11-20' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses a year past 9999 that sorts before the limit as text (REV-ERR-0e8afdf9)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, 'Way off');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '20266-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('at most five years ahead');
    await userEvent.type(input, '{Enter}');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('accepts the last allowed day and drops the message once the date is back in range (REV-ERR-0e8afdf9)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, 'Edge');
    const date = screen.getByLabelText('Due date');
    fireEvent.change(date, { target: { value: '2032-01-01' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(date, { target: { value: '2031-11-16' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(date).not.toHaveAttribute('aria-invalid');
    await userEvent.type(input, '{Enter}');
    expect(onAdd).toHaveBeenCalledWith({
      title: 'Edge',
      dueDate: '2031-11-16',
      priority: 'medium',
    });
  });

  it('sends the chosen date and priority with the title (AC-2)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, 'Pay rent');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-20' } });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'high');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith({
      title: 'Pay rent',
      dueDate: '2026-11-20',
      priority: 'high',
    });
  });

  it('adds from Enter in the date field too, and resets both fields after (AC-1 AC-2)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, 'Pay rent');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-20' } });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'low');
    await userEvent.type(screen.getByLabelText('Due date'), '{Enter}');
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Due date')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveValue('medium');
    expect(input).toHaveFocus();
  });
});
