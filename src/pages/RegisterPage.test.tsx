// tier: component
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { server } from '../test/mocks/server';
import { renderWithProviders, screen, waitFor } from '../test/utils';
import { RegisterPage } from './RegisterPage';

describe('RegisterPage', () => {
  it('asks only for a username and a password (AC-2 BR-4 TS-2)', () => {
    renderWithProviders(<RegisterPage />);
    const inputs =
      screen.getAllByRole('textbox').length +
      document.querySelectorAll('input[type="password"]').length;
    expect(inputs).toBe(2);
    expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeInTheDocument();
  });

  it('can be completed by keyboard alone (AC-1 NFR-accessibility)', async () => {
    const user = userEvent.setup();
    let received: unknown;
    server.use(
      http.post('/api/auth/register', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ user: { id: '1', username: 'priya_b' } }, { status: 201 });
      }),
    );
    renderWithProviders(<RegisterPage />);
    await user.tab();
    expect(screen.getByLabelText('Username')).toHaveFocus();
    await user.keyboard('Priya_B');
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.keyboard('a long passphrase{Enter}');
    await waitFor(() =>
      expect(received).toEqual({ username: 'Priya_B', password: 'a long passphrase' }),
    );
  });

  it('shows the missing-field messages without a request (AC-5 BR-4 TS-6 TS-7)', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post('/api/auth/register', () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderWithProviders(<RegisterPage />);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter a username.')).toBeInTheDocument();
    expect(screen.getByText('Enter a password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveFocus();
    expect(called).toBe(false);
  });

  it('shows local format and length hints under the matching field (AC-6 AC-7 AC-8)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByLabelText('Username'), 'a b');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    const username = screen.getByLabelText('Username');
    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(username.getAttribute('aria-describedby')).toContain('username-error');
    expect(
      screen.getByText('Username can only use letters, numbers and underscores.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });

  it('never mentions email, verification, terms, privacy or Google (AC-14 BR-4 TS-19)', () => {
    const { container } = renderWithProviders(<RegisterPage />);
    expect(container.textContent ?? '').not.toMatch(/e-?mail|verif|terms|privacy|google/i);
  });

  it('keeps the typed password masked and out of the page text after a refused submit (AC-14 NFR-data-classification)', async () => {
    const user = userEvent.setup();
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
    const { container } = renderWithProviders(<RegisterPage />);
    await user.type(screen.getByLabelText('Username'), 'priya_b');
    await user.type(screen.getByLabelText('Password'), 'supersecret1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('That password is too common. Choose a stronger one.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(container.textContent ?? '').not.toContain('supersecret1');
  });

  it('renders a hostile username as inert text, never as markup (AC-14 TS-12)', async () => {
    const user = userEvent.setup();
    const hostile = '<img src=x onerror=alert(1)>';
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByLabelText('Username'), hostile);
    await user.type(screen.getByLabelText('Password'), 'longenough1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByLabelText('Username')).toHaveValue(hostile);
  });
});
