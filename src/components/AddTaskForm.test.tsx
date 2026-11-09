// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddTaskForm } from './AddTaskForm';

function setup() {
  const onAdd = vi.fn();
  render(<AddTaskForm onAdd={onAdd} />);
  return { onAdd, input: screen.getByLabelText('New task') };
}

describe('AddTaskForm', () => {
  it('adds on Enter with the trimmed title, clears the field and keeps focus (AC-4 TS-3)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, '  Send brand colours to Techjays {Enter}');
    expect(onAdd).toHaveBeenCalledWith('Send brand colours to Techjays');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('adds when the Add button is clicked instead (AC-4 TS-4)', async () => {
    const { onAdd, input } = setup();
    await userEvent.type(input, 'Buy milk');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('Buy milk');
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
    expect(onAdd).toHaveBeenCalledWith('z'.repeat(200));
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

  it('has one labelled field and one Add button, nothing for description, due date or priority (AC-8 BR-1 TS-11)', () => {
    setup();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(/due|priority|notes|description/i)).not.toBeInTheDocument();
  });

  it('is operable by keyboard alone (NFR accessibility)', async () => {
    const { onAdd, input } = setup();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.keyboard('Plan launch');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledWith('Plan launch');
  });
});
