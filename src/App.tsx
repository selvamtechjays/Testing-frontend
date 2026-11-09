import { Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { LogOutButton } from './components/LogOutButton';
import { RegisterPage } from './pages/RegisterPage';
import { TaskListPage } from './pages/TaskListPage';
import { SignInPage } from './pages/SignInPage';

function App() {
  const { status } = useAuth();
  const { pathname } = useLocation();
  const showLogOut = status === 'signedIn' && pathname === '/';
  return (
    <AppShell headerActions={showLogOut ? <LogOutButton /> : null}>
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
    </AppShell>
  );
}

export default App;
