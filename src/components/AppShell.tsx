import type { ReactNode } from 'react';
import { copy } from '../copy';

interface AppShellProps {
  children: ReactNode;
  headerActions?: ReactNode;
}

/** Shared frame: one header, one main landmark, route outlet as children. */
export function AppShell({ children, headerActions }: AppShellProps) {
  return (
    <div className="shell">
      <header className="shell-header">
        <span className="shell-brand">{copy.appName}</span>
        {headerActions ? <div className="shell-actions">{headerActions}</div> : null}
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
