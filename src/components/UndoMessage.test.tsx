// tier: component
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UndoMessage } from './UndoMessage';

describe('UndoMessage', () => {
  it('renders nothing when there is no pending deletion (AC-3 AC-5)', () => {
    const { container } = render(<UndoMessage visible={false} onUndo={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows "Task deleted - Undo" in a status region (AC-1 BR-1)', () => {
    render(<UndoMessage visible onUndo={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Task deleted - Undo');
  });

  it('offers exactly one action, Undo, and no spinner or countdown (AC-1 BR-1)', () => {
    render(<UndoMessage visible onUndo={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+\s*(s|sec|seconds)/i)).not.toBeInTheDocument();
  });

  it('calls onUndo when clicked (AC-2 TS-2)', async () => {
    const onUndo = vi.fn();
    render(<UndoMessage visible onUndo={onUndo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('is operable by keyboard with Enter and Space (NFR accessibility)', async () => {
    const onUndo = vi.fn();
    render(<UndoMessage visible onUndo={onUndo} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onUndo).toHaveBeenCalledTimes(2);
  });
});
