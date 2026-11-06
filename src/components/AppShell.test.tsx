// tier: component
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('wraps children in a single main landmark under one header (AC-5 TS-5)', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });

  it('renders header actions reachable by Tab and activated with Enter (AC-5 AC-7 TS-8)', async () => {
    const user = userEvent.setup();
    const onLogOut = vi.fn();
    render(
      <AppShell
        headerActions={
          <button type="button" onClick={onLogOut}>
            Log out
          </button>
        }
      >
        <p>content</p>
      </AppShell>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Log out' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it('renders no actions area when none are given (AC-10)', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
