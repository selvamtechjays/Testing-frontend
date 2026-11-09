// tier: integration
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { server } from '../test/mocks/server';
import { renderWithProviders, screen, waitFor } from '../test/utils';
import { RegisterPage } from './RegisterPage';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<p>home reached</p>} />
    </Routes>,
    { route: '/register' },
  );
}

async function fillAndSubmit(username: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterPage with the register endpoint', { timeout: 15000 }, () => {
  it('posts the credentials, signs in and lands on home on 201 (AC-1 BR-6 TS-1)', async () => {
    let body: unknown;
    server.use(
      http.post('/api/auth/register', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: { id: '665f', username: 'priya_b' } }, { status: 201 });
      }),
    );
    renderPage();
    await fillAndSubmit('Priya_B', 'correct horse battery');
    expect(await screen.findByText('home reached')).toBeInTheDocument();
    expect(body).toEqual({ username: 'Priya_B', password: 'correct horse battery' });
  });

  it('disables the button and shows progress while the request is pending (AC-1)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('/api/auth/register', async () => {
        await gate;
        return HttpResponse.json({ user: { id: '1', username: 'abc' } }, { status: 201 });
      }),
    );
    renderPage();
    await fillAndSubmit('abc', 'password123');
    const button = await screen.findByRole('button', { name: 'Creating account...' });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Username')).toHaveValue('abc');
    release();
    expect(await screen.findByText('home reached')).toBeInTheDocument();
  });

  it('shows the server field messages on 400 and keeps the typed values (AC-9 AC-13 BR-2 TS-14)', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION',
              message: 'Validation failed',
              fields: { password: 'That password is too common. Choose a stronger one.' },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderPage();
    await fillAndSubmit('priya_b', 'password123');
    expect(
      await screen.findByText('That password is too common. Choose a stronger one.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('priya_b');
    expect(screen.getByLabelText('Password')).toHaveValue('password123');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.queryByText('home reached')).not.toBeInTheDocument();
    // DEC-092: the shared top-level text is never shown; only per-field messages are.
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });

  it('shows the generic message when a 400 carries no field messages (AC-13 DEC-092)', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION', message: 'Validation failed', fields: {} } },
          { status: 400 },
        ),
      ),
    );
    renderPage();
    await fillAndSubmit('priya_b', 'correct horse battery');
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });

  it('shows the taken-username message under the username field on 409 (AC-10 AC-11 BR-3 TS-15 TS-16)', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          {
            error: {
              code: 'USERNAME_TAKEN',
              message: 'Conflict',
              fields: { username: 'That username is already taken. Choose another.' },
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderPage();
    await fillAndSubmit('priya_b', 'correct horse battery');
    const message = await screen.findByText('That username is already taken. Choose another.');
    expect(screen.getByLabelText('Username').getAttribute('aria-describedby')).toContain(
      message.id,
    );
    expect(screen.getByLabelText('Username')).toHaveFocus();
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
    expect(screen.queryByText('home reached')).not.toBeInTheDocument();
  });

  it('shows one generic message and re-enables the button on a network failure (AC-13)', async () => {
    server.use(http.post('/api/auth/register', () => HttpResponse.error()));
    renderPage();
    await fillAndSubmit('priya_b', 'correct horse battery');
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled(),
    );
    expect(screen.getByLabelText('Username')).toHaveValue('priya_b');
  });

  it('shows the generic message on a 5xx (AC-13)', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'db exploded at host-7' } },
          { status: 500 },
        ),
      ),
    );
    renderPage();
    await fillAndSubmit('priya_b', 'correct horse battery');
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText(/db exploded/)).not.toBeInTheDocument();
    expect(screen.queryByText('home reached')).not.toBeInTheDocument();
  });

  it('routes to sign-in when any call answers 401 UNAUTHENTICATED (DEC-074)', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 }),
      ),
    );
    renderWithProviders(
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/signin" element={<p>sign-in reached</p>} />
      </Routes>,
      { route: '/register' },
    );
    await fillAndSubmit('priya_b', 'correct horse battery');
    expect(await screen.findByText('sign-in reached')).toBeInTheDocument();
  });
});
