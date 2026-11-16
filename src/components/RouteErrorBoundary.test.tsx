// tier: component
import { lazy, Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { RouteErrorBoundary } from './RouteErrorBoundary';

const Broken = lazy(() => Promise.reject(new Error('chunk failed')));

describe('RouteErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a message and a Reload button when a lazy page fails to load, and Reload reloads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });
    render(
      <RouteErrorBoundary>
        <Suspense fallback={null}>
          <Broken />
        </Suspense>
      </RouteErrorBoundary>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i);
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders children untouched when nothing fails', () => {
    render(
      <RouteErrorBoundary>
        <p>fine</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
