import { useEffect, useState } from 'react';
import { copy } from '../copy';
import {
  getThemePreference,
  onSystemThemeChange,
  resolveTheme,
  setThemePreference,
} from '../lib/theme';
import { Button } from './Button';
import './ThemeToggle.css';

/** Header control: flips between light and dark and remembers the choice on this device. */
export function ThemeToggle() {
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme());

  useEffect(() => {
    setResolved(resolveTheme());
    return onSystemThemeChange(() => {
      if (getThemePreference() === 'system') setResolved(resolveTheme());
    });
  }, []);

  const isDark = resolved === 'dark';
  const flip = () => {
    const next = isDark ? 'light' : 'dark';
    setThemePreference(next);
    setResolved(next);
  };

  return (
    <Button
      variant="quiet"
      className="theme-toggle"
      aria-label={copy.themeToggle}
      aria-pressed={isDark}
      onClick={flip}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          className="theme-toggle-sun"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          className="theme-toggle-moon"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </span>
    </Button>
  );
}
