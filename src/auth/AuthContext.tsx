import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, type User } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';

export type AuthStatus = 'checking' | 'signedIn' | 'signedOut';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  setUser: (user: User | null) => void;
  /** Records a successful sign-in or registration. */
  signedIn: (user: User) => void;
  /** Forgets the signed-in user locally; never touches the server. */
  clear: () => void;
  /** Re-asks the server who is signed in (used when the page is restored from history). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const navigate = useNavigate();

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    setStatus(next ? 'signedIn' : 'signedOut');
  }, []);
  const signedIn = useCallback((next: User) => setUser(next), [setUser]);
  const clear = useCallback(() => setUser(null), [setUser]);

  // Any failure to confirm a session (401 or network) means signed out: nothing protected renders.
  const refresh = useCallback(async () => {
    try {
      setUser((await getCurrentUser()).user);
    } catch {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A 401 UNAUTHENTICATED anywhere signs the client out and routes to sign-in, handled once here (DEC-064, DEC-074).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
      navigate('/signin', { replace: true, state: { signedOut: true } });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, clear]);

  const value = useMemo(
    () => ({ status, user, setUser, signedIn, clear, refresh }),
    [status, user, setUser, signedIn, clear, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
