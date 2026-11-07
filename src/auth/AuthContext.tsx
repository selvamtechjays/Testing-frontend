import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUnauthorizedHandler } from '../api/client';
import type { User } from '../api/auth';

interface AuthValue {
  user: User | null;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  // A 401 anywhere signs the client out and routes to sign-in, handled once here (DEC-064, DEC-074).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate('/signin', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  const value = useMemo(() => ({ user, setUser }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
