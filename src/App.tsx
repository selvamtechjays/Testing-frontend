import { Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { LogOutButton } from './components/LogOutButton';
import { copy } from './copy';
import { RegisterPage } from './pages/RegisterPage';
import { SignInPage } from './pages/SignInPage';

function Home() {
  return (
    <>
      <h1>{copy.homeHeading}</h1>
      <p>{copy.homeIntro}</p>
    </>
  );
}

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
              <Home />
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
