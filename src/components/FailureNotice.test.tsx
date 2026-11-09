// tier: component
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { copy } from '../copy';
import { FailureNoticeProvider, useFailureNotice } from '../lib/FailureNoticeContext';
import { render, screen } from '@testing-library/react';
import { FailureNotice } from './FailureNotice';

describe('FailureNotice', () => {
  it('renders nothing while there is no message (AC-2)', () => {
    const { container } = render(<FailureNotice message={null} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the message in an alert region with no spinner (AC-3 BR-1 BR-3)', () => {
    render(<FailureNotice message={copy.saveFailed} onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save your change. It was undone.',
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('dismisses with the button (BR-3)', async () => {
    const onDismiss = vi.fn();
    render(<FailureNotice message="x" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: copy.dismiss }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses with Escape while focus is inside the region (BR-3)', async () => {
    const onDismiss = vi.fn();
    render(<FailureNotice message="x" onDismiss={onDismiss} />);
    screen.getByRole('button', { name: copy.dismiss }).focus();
    await userEvent.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses with Escape wherever focus is, and stops listening once hidden (BR-3)', async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<FailureNotice message="x" onDismiss={onDismiss} />);
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    rerender(<FailureNotice message={null} onDismiss={onDismiss} />);
    await userEvent.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys (BR-3)', async () => {
    const onDismiss = vi.fn();
    render(<FailureNotice message="x" onDismiss={onDismiss} />);
    screen.getByRole('button', { name: copy.dismiss }).focus();
    await userEvent.keyboard('a');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('is operable by keyboard alone (BR-3)', async () => {
    const onDismiss = vi.fn();
    render(<FailureNotice message="x" onDismiss={onDismiss} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: copy.dismiss })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

function Harness() {
  const { message, show, dismiss } = useFailureNotice();
  return (
    <>
      <button type="button" onClick={() => show('first')}>
        first
      </button>
      <button type="button" onClick={() => show('second')}>
        second
      </button>
      <FailureNotice message={message} onDismiss={dismiss} />
    </>
  );
}

describe('FailureNotice with its store', () => {
  it('replaces the visible message in the same single region, then hides on dismiss (BR-3)', async () => {
    render(
      <FailureNoticeProvider>
        <Harness />
      </FailureNoticeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'first' }));
    expect(screen.getByRole('alert')).toHaveTextContent('first');
    await userEvent.click(screen.getByRole('button', { name: 'second' }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('second');
    await userEvent.click(screen.getByRole('button', { name: copy.dismiss }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses to be used outside its provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/FailureNoticeProvider/);
    spy.mockRestore();
  });
});
