// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { copy } from '../copy';
import { SearchLiveRegion, TaskSearch } from './TaskSearch';

function Controlled({ onChange = () => {} }: { onChange?: (text: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <TaskSearch
      value={value}
      onChange={(text) => {
        setValue(text);
        onChange(text);
      }}
    />
  );
}

describe('TaskSearch (Task-22 AC-6 AC-8)', () => {
  it('is a labelled search input a keyboard or screen reader user can find (AC-8)', () => {
    render(<Controlled />);
    const input = screen.getByRole('searchbox', { name: copy.searchLabel });
    expect(input).toHaveAttribute('type', 'search');
    expect(screen.getByText('Search tasks')).toBeInTheDocument();
  });

  it('stops accepting text at 100 characters (AC-4 UI side)', async () => {
    render(<Controlled />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('maxlength', '100');
    await userEvent.type(input, 'a'.repeat(105));
    expect(input).toHaveValue('a'.repeat(100));
  });

  it('reports every keystroke through onChange (AC-6)', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.type(screen.getByRole('searchbox'), 'milk');
    expect(onChange).toHaveBeenLastCalledWith('milk');
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('Escape while focused empties the box (AC-6 AC-8)', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'milk');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('Escape in an empty box does nothing (AC-6)', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    screen.getByRole('searchbox').focus();
    await userEvent.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SearchLiveRegion (AC-7 AC-8)', () => {
  it('is a polite live region that carries the message', () => {
    const { container } = render(<SearchLiveRegion message="2 tasks found." />);
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('2 tasks found.');
  });

  it('stays mounted and empty when there is nothing to say', () => {
    const { container } = render(<SearchLiveRegion message="" />);
    expect(container.querySelector('[aria-live="polite"]')).toBeEmptyDOMElement();
  });
});
