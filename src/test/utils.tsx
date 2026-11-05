import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

// Single place to wrap app-level providers (router, query client, theme...) as they appear.
function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
