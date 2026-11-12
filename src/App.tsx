import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { LogOutButton } from './components/LogOutButton';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { ThemeToggle } from './components/ThemeToggle';

// Each screen is its own chunk, fetched when its route is first visited (keeps the entry bundle small).
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const TaskListPage = lazy(() =>
  import('./pages/TaskListPage').then((m) => ({ default: m.TaskListPage })),
);
const SignInPage = lazy(() =>
  import('./pages/SignInPage').then((m) => ({ default: m.SignInPage })),
);

function App() {
  const { status } = useAuth();
  const { pathname } = useLocation();
  const showLogOut = status === 'signedIn' && pathname === '/';
  return (
    <AppShell
      headerActions={
        <>
          <ThemeToggle />
          {showLogOut ? <LogOutButton /> : null}
        </>
      }
    >
      <RouteErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            <Route
              path="/"
              element={
                <RequireAuth>
                  <TaskListPage />
                </RequireAuth>
              }
            />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/signin" element={<SignInPage />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </AppShell>
  );
}

export default App;
