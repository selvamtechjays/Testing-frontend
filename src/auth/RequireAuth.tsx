import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Renders nothing protected until the server has confirmed a session (BR-4, AC-9). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, refresh } = useAuth();

  // Back/forward-cache restores skip the mount check, so ask the server again.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refresh();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refresh]);

  if (status === 'checking') return <div data-testid="auth-checking" />;
  if (status === 'signedOut') return <Navigate to="/signin" replace />;
  return <>{children}</>;
}
