// tier: integration
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '../api/client';
import { SignInPage } from '../pages/SignInPage';
import { server } from '../test/mocks/server';
import { meSignedIn, unauthenticatedBody } from '../test/mocks/auth';
import { renderWithProviders, screen } from '../test/utils';
import { useAuth } from './AuthContext';

function Probe() {
  const { status, user } = useAuth();
  return (
    <>
      <p>status: {status}</p>
      <p>user: {user?.username ?? 'none'}</p>
      <button type="button" onClick={() => void apiFetch('/tasks').catch(() => undefined)}>
        load tasks
      </button>
    </>
  );
}

function renderProbe() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<Probe />} />
      <Route path="/signin" element={<SignInPage />} />
    </Routes>,
  );
}

describe('AuthProvider', () => {
  it('starts checking, then reports signed in with the user from /me (AC-3)', async () => {
    server.use(meSignedIn);
    renderProbe();
    expect(screen.getByText('status: checking')).toBeInTheDocument();
    expect(await screen.findByText('status: signedIn')).toBeInTheDocument();
    expect(screen.getByText('user: selvam')).toBeInTheDocument();
  });

  it('reports signed out on 401 from /me without redirecting a public page (AC-3)', async () => {
    renderProbe();
    expect(await screen.findByText('status: signedOut')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('signs out and shows the sign-in page with a notice when any call answers 401 UNAUTHENTICATED (AC-4 DEC-074 DEC-083)', async () => {
    server.use(meSignedIn);
    renderProbe();
    await screen.findByText('status: signedIn');
    server.use(
      http.get('/api/tasks', () => HttpResponse.json(unauthenticatedBody, { status: 401 })),
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'load tasks' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You have been signed out.');
  });

  it('leaves the user signed in when a call answers 401 with another code (DEC-083)', async () => {
    server.use(meSignedIn);
    renderProbe();
    await screen.findByText('status: signedIn');
    server.use(
      http.get('/api/tasks', () =>
        HttpResponse.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password.' } },
          { status: 401 },
        ),
      ),
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'load tasks' }));
    expect(screen.getByText('status: signedIn')).toBeInTheDocument();
  });
});
