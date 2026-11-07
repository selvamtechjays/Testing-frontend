// tier: component
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { server } from '../test/mocks/server';
import { meSignedIn, unauthenticatedBody } from '../test/mocks/auth';
import { renderWithProviders, screen, waitFor } from '../test/utils';
import { RequireAuth } from './RequireAuth';

function renderGuarded() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <p>secret task list</p>
          </RequireAuth>
        }
      />
      <Route path="/signin" element={<p>sign-in page</p>} />
    </Routes>,
  );
}

describe('RequireAuth', () => {
  it('renders nothing protected while the session check is pending (AC-9 R-1)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/auth/me', async () => {
        await gate;
        return HttpResponse.json({ user: { id: '1', username: 'selvam' } });
      }),
    );
    renderGuarded();
    expect(screen.queryByText('secret task list')).not.toBeInTheDocument();
    expect(screen.queryByText('sign-in page')).not.toBeInTheDocument();
    release();
    expect(await screen.findByText('secret task list')).toBeInTheDocument();
  });

  it('shows the task list when the server confirms a session (AC-1)', async () => {
    server.use(meSignedIn);
    renderGuarded();
    expect(await screen.findByText('secret task list')).toBeInTheDocument();
  });

  it('redirects to sign-in on 401 and never renders the list (AC-9 BR-4)', async () => {
    renderGuarded();
    expect(await screen.findByText('sign-in page')).toBeInTheDocument();
    expect(screen.queryByText('secret task list')).not.toBeInTheDocument();
  });

  it('redirects to sign-in when the check cannot reach the server (R-1)', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.error()));
    renderGuarded();
    expect(await screen.findByText('sign-in page')).toBeInTheDocument();
    expect(screen.queryByText('secret task list')).not.toBeInTheDocument();
  });

  it('re-checks the session when restored from history and the session is gone (AC-9)', async () => {
    server.use(meSignedIn);
    renderGuarded();
    expect(await screen.findByText('secret task list')).toBeInTheDocument();
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(unauthenticatedBody, { status: 401 })),
    );
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await waitFor(() => expect(screen.getByText('sign-in page')).toBeInTheDocument());
    expect(screen.queryByText('secret task list')).not.toBeInTheDocument();
  });

  it('does not re-check on an ordinary pageshow (persisted false)', async () => {
    server.use(meSignedIn);
    renderGuarded();
    expect(await screen.findByText('secret task list')).toBeInTheDocument();
    let asked = 0;
    server.use(
      http.get('/api/auth/me', () => {
        asked += 1;
        return HttpResponse.json(unauthenticatedBody, { status: 401 });
      }),
    );
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    });
    expect(asked).toBe(0);
    expect(screen.getByText('secret task list')).toBeInTheDocument();
  });
});
