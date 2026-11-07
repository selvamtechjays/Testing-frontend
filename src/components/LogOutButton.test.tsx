// tier: integration
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { RequireAuth } from '../auth/RequireAuth';
import { server } from '../test/mocks/server';
import { meSignedIn, unauthenticatedBody } from '../test/mocks/auth';
import { renderWithProviders, screen } from '../test/utils';
import { SignInPage } from '../pages/SignInPage';
import { LogOutButton } from './LogOutButton';

function renderSignedIn() {
  server.use(meSignedIn);
  return renderWithProviders(
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <LogOutButton />
            <p>task list</p>
          </RequireAuth>
        }
      />
      <Route path="/signin" element={<SignInPage />} />
    </Routes>,
  );
}

async function logOut() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Log out' }));
}

describe('LogOutButton', () => {
  it('calls logout, shows the sign-in page and then keeps the list out of reach (AC-5 AC-9 BR-4 TS-5)', async () => {
    let called = 0;
    server.use(
      http.post('/api/auth/logout', () => {
        called += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSignedIn();
    await logOut();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(called).toBe(1);
    expect(screen.queryByText('task list')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the sign-in page without an error when the session already expired (AC-10 TS-13)', async () => {
    server.use(
      http.post('/api/auth/logout', () => HttpResponse.json(unauthenticatedBody, { status: 401 })),
    );
    renderSignedIn();
    await logOut();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still signs out locally when the network fails, without an error (AC-10)', async () => {
    server.use(http.post('/api/auth/logout', () => HttpResponse.error()));
    renderSignedIn();
    await logOut();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('task list')).not.toBeInTheDocument();
  });

  it('is reachable by keyboard and activates with Enter (AC-5)', async () => {
    server.use(http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })));
    renderSignedIn();
    const button = await screen.findByRole('button', { name: 'Log out' });
    const user = userEvent.setup();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
