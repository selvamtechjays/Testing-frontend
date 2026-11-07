// tier: component
import { describe, expect, it } from 'vitest';
import App from './App';
import { server } from './test/mocks/server';
import { meSignedIn } from './test/mocks/auth';
import { renderWithProviders, screen } from './test/utils';

async function renderHome() {
  server.use(meSignedIn);
  renderWithProviders(<App />, { route: '/' });
  await screen.findByRole('heading', { level: 1, name: 'TaskNest' });
}

describe('App', () => {
  it('renders the shell with one banner, one main landmark and the app heading (AC-4 TS-4)', async () => {
    await renderHome();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('offers no language control, logo, dark-mode switch or cookie prompt, and only Log out as a button (AC-8 AC-10 TS-9 TS-11)', async () => {
    await renderHome();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Log out']);
    expect(screen.queryByText(/cookie|analytics|privacy|terms/i)).not.toBeInTheDocument();
  });
});

describe('App routes', () => {
  it('serves the registration page at /register (AC-1 AC-2)', async () => {
    renderWithProviders(<App />, { route: '/register' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('serves the sign-in page at /signin (AC-1)', async () => {
    renderWithProviders(<App />, { route: '/signin' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor from the task list address to sign-in (AC-9 TS-12)', async () => {
    renderWithProviders(<App />, { route: '/' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TaskNest' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });
});
