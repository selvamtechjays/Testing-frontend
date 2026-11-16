export type ThemePreference = 'light' | 'dark' | 'system';

/** Also written in public/theme-init.js (runs before first paint); theme.test.ts keeps the two in step. */
export const THEME_STORAGE_KEY = 'tasknest-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The saved choice, or 'system' when nothing is saved or storage is unavailable. */
export function getThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Saves the choice ('system' clears it). A storage failure keeps the in-memory theme only. */
export function setThemePreference(
  pref: ThemePreference,
  root: HTMLElement = document.documentElement,
): void {
  try {
    if (pref === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // storage unavailable: the theme still applies for this session
  }
  applyThemePreference(root, pref);
}

/** Mirrors the preference onto <html data-theme>; absent means follow the device (index.css). */
export function applyThemePreference(
  root: HTMLElement = document.documentElement,
  pref: ThemePreference = getThemePreference(),
): void {
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}

/** True when the device currently asks for a dark colour scheme. */
export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

/** The theme actually showing right now. */
export function resolveTheme(pref: ThemePreference = getThemePreference()): 'light' | 'dark' {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

/** Calls back when the device colour scheme changes; returns an unsubscribe function. */
export function onSystemThemeChange(callback: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(DARK_QUERY);
  if (typeof query.addEventListener !== 'function') return () => {};
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
