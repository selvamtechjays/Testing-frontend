// tier: component
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('renders the shell with one banner, one main landmark and the app heading (AC-4 TS-4)', () => {
    renderApp();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'TaskNest' })).toBeInTheDocument();
  });

  it('offers no language control, logo, dark-mode switch or cookie prompt (AC-8 AC-10 TS-9 TS-11)', () => {
    renderApp();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/cookie|analytics|privacy|terms/i)).not.toBeInTheDocument();
  });
});
