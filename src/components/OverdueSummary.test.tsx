// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OverdueSummary } from './OverdueSummary';

describe('OverdueSummary', () => {
  it('is a button reading "N overdue" (AC-13)', () => {
    render(<OverdueSummary count={3} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: '3 overdue' })).toBeInTheDocument();
  });

  it('is hidden at 0 (AC-13)', () => {
    render(<OverdueSummary count={0} onSelect={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls back on click, Enter and Space (AC-13 AC-15)', async () => {
    const onSelect = vi.fn();
    render(<OverdueSummary count={1} onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: '1 overdue' });
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onSelect).toHaveBeenCalledTimes(3);
  });
});
