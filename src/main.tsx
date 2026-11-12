import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './fonts.css';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthContext';
import { applyMotionPreference, watchMotionPreference } from './lib/motion';
import { applyThemePreference } from './lib/theme';

applyMotionPreference();
watchMotionPreference();
applyThemePreference();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
