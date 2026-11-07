// tier: integration
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { server } from '../test/mocks/server';
import { USER, invalidCredentialsBody, meSignedIn, validationBody } from '../test/mocks/auth';
import { renderWithProviders, screen, waitFor } from '../test/utils';
import { SignInPage } from './SignInPage';

const GENERIC = 'Incorrect username or password.';

function renderPage(route = '/signin') {
  return renderWithProviders(
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/" element={<p>task list reached</p>} />
      <Route path="/register" element={<p>register page</p>} />
    </Routes>,
    { route },
  );
}

async function fillAndSubmit(username: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

function refuseLogin() {
  server.use(
    http.post('/api/auth/login', () => HttpResponse.json(invalidCredentialsBody, { status: 401 })),
  );
}

describe('SignInPage form', () => {
  it('has labelled username and password fields with the right autocomplete and no extras (AC-11 TS-10)', async () => {
    renderPage();
    const username = await screen.findByLabelText('Username');
    const password = screen.getByLabelText('Password');
    expect(username).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/remember|forgot/i)).not.toBeInTheDocument();
  });

  it('blocks an empty submit with no network call and names no field (BR-2)', async () => {
    let calls = 0;
    server.use(
      http.post('/api/auth/login', () => {
        calls += 1;
        return HttpResponse.json({ user: USER });
      }),
    );
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a username and password.');
    await user.type(screen.getByLabelText('Username'), 'selvam');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(calls).toBe(0);
  });
});

describe('SignInPage success', () => {
  it('sends the username exactly as typed and opens the task list (AC-1 AC-2 BR-1 TS-1 TS-2)', async () => {
    let body: unknown;
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: USER });
      }),
    );
    renderPage();
    await fillAndSubmit('Selvam', 'hunter2hunter2');
    expect(await screen.findByText('task list reached')).toBeInTheDocument();
    expect(body).toEqual({ username: 'Selvam', password: 'hunter2hunter2' });
  });

  it('disables the button and shows progress while the request is pending', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('/api/auth/login', async () => {
        await gate;
        return HttpResponse.json({ user: USER });
      }),
    );
    renderPage();
    await fillAndSubmit('selvam', 'hunter2hunter2');
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    release();
    expect(await screen.findByText('task list reached')).toBeInTheDocument();
  });
});

describe('SignInPage refusals', () => {
  it('shows the one generic message for a credential refusal, clears the password and focuses it (AC-6 AC-7 BR-2 TS-6 TS-7)', async () => {
    refuseLogin();
    renderPage();
    await fillAndSubmit('selvam', 'wrong password');
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC);
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByLabelText('Username')).toHaveValue('selvam');
    expect(screen.queryByText('task list reached')).not.toBeInTheDocument();
  });

  it('never renders the server message, whatever the server sends (DEC-092)', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'SERVER-TEXT unknown user nobody' } },
          { status: 401 },
        ),
      ),
    );
    renderPage();
    await fillAndSubmit('nobody', 'whatever1');
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC);
    expect(screen.queryByText(/SERVER-TEXT|nobody/)).not.toBeInTheDocument();
  });

  it('treats a 400 VALIDATION from the server with the same generic message, not its top-level text', async () => {
    server.use(
      http.post('/api/auth/login', () => HttpResponse.json(validationBody, { status: 400 })),
    );
    renderPage();
    await fillAndSubmit('selvam', 'x');
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC);
    expect(screen.queryByText(validationBody.error.message)).not.toBeInTheDocument();
  });

  it('shows a separate try-again message on a network failure and keeps the password (TS-6)', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.error()));
    renderPage();
    await fillAndSubmit('selvam', 'hunter2hunter2');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign in. Try again.');
    expect(screen.getByLabelText('Password')).toHaveValue('hunter2hunter2');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows the try-again message on a 500 and never its server text', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'stack trace leak' } },
          { status: 500 },
        ),
      ),
    );
    renderPage();
    await fillAndSubmit('selvam', 'hunter2hunter2');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign in. Try again.');
    expect(screen.queryByText(/stack trace leak/)).not.toBeInTheDocument();
  });

  it('allows ten wrong attempts and then a correct one with no lockout text (AC-8 TS-9)', async () => {
    refuseLogin();
    renderPage();
    const user = await fillAndSubmit('selvam', 'wrong1');
    for (let attempt = 0; attempt < 9; attempt += 1) {
      await user.type(screen.getByLabelText('Password'), `wrong${attempt}`);
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      await waitFor(() => expect(screen.getByLabelText('Password')).toHaveValue(''));
    }
    expect(screen.queryByText(/locked|too many|wait|attempt/i)).not.toBeInTheDocument();
    server.use(http.post('/api/auth/login', () => HttpResponse.json({ user: USER })));
    await user.type(screen.getByLabelText('Password'), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('task list reached')).toBeInTheDocument();
  });

  it('shows tag-like input as escaped text only and echoes no password (TS-8 NFR)', async () => {
    refuseLogin();
    const { container } = renderPage();
    await fillAndSubmit('<img src=x onerror=alert(1)>', 'secret-pass-123');
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).not.toContain('secret-pass-123');
  });
});

describe('SignInPage routing', () => {
  it('redirects a signed-in user to the task list (DEC-066)', async () => {
    server.use(meSignedIn);
    renderPage();
    expect(await screen.findByText('task list reached')).toBeInTheDocument();
  });

  it('does not show the signed-out notice on a plain visit', async () => {
    renderPage();
    await screen.findByLabelText('Username');
    expect(screen.queryByText('You have been signed out.')).not.toBeInTheDocument();
  });
});
