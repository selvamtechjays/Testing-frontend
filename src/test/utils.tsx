import { render, within, screen, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';

// Single place to wrap app-level providers (router, auth, ...) as they appear.
function makeProviders(route: string) {
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    );
  };
}

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const { route = '/', ...rest } = options;
  return render(ui, { wrapper: makeProviders(route), ...rest });
}

export * from '@testing-library/react';

const DELETE_LABEL = /^Delete /;

/**
 * The task titles on screen, in order, read by role: each list item's Delete button is named
 * "Delete <title>" and a row being edited shows its title in a text box.
 */
export function listedTitles(): string[] {
  return screen.queryAllByRole('listitem').map((row) => {
    const remove = within(row).queryByRole('button', { name: DELETE_LABEL });
    if (remove) return (remove.getAttribute('aria-label') ?? '').replace(DELETE_LABEL, '');
    return (within(row).getByRole('textbox') as HTMLInputElement).value;
  });
}
