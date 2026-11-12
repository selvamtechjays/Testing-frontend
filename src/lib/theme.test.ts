// tier: unit
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyThemePreference,
  getThemePreference,
  onSystemThemeChange,
  resolveTheme,
  setThemePreference,
  THEME_STORAGE_KEY,
} from './theme';

const stubMatchMedia = (matches: boolean, extra: object = {}) =>
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches, ...extra }));

describe('theme preference (Task-21 AC-2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('is "system" when nothing is saved or the saved value is unknown', () => {
    expect(getThemePreference()).toBe('system');
    window.localStorage.setItem('tasknest-theme', 'purple');
    expect(getThemePreference()).toBe('system');
  });

  it('saves an explicit choice under tasknest-theme and sets data-theme', () => {
    setThemePreference('dark');
    expect(window.localStorage.getItem('tasknest-theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getThemePreference()).toBe('dark');
    setThemePreference('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('"system" clears the saved choice and removes data-theme so the device decides', () => {
    setThemePreference('dark');
    setThemePreference('system');
    expect(window.localStorage.getItem('tasknest-theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('applies the saved choice at start-up (survives a reload)', () => {
    window.localStorage.setItem('tasknest-theme', 'dark');
    applyThemePreference();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('never throws when storage is unavailable, and still applies the theme for the session', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getThemePreference()).toBe('system');
    expect(() => setThemePreference('dark')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('resolves "system" from the device colour scheme', () => {
    stubMatchMedia(true);
    expect(resolveTheme('system')).toBe('dark');
    stubMatchMedia(false);
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('resolves to light where the browser cannot report a colour scheme', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('system')).toBe('light');
    expect(() => onSystemThemeChange(() => {})()).not.toThrow();
  });

  it('subscribes to device scheme changes and unsubscribes', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    stubMatchMedia(false, { addEventListener, removeEventListener });
    const callback = vi.fn();
    const stop = onSystemThemeChange(callback);
    expect(addEventListener).toHaveBeenCalledWith('change', callback);
    stop();
    expect(removeEventListener).toHaveBeenCalledWith('change', callback);
  });
});

describe('anti-flash script public/theme-init.js (Task-21 AC-2, CR-4)', () => {
  const script = readFileSync(join(__dirname, '../../public/theme-init.js'), 'utf8');

  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('reads the same storage key as the app', () => {
    expect(script).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });

  it('accepts only light and dark', () => {
    expect([...script.matchAll(/=== '([^']+)'/g)].map((m) => m[1]).sort()).toEqual([
      'dark',
      'light',
    ]);
  });

  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
    ['purple', undefined],
  ])('applies a saved %s as data-theme %s', (saved, expected) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, saved);
    new Function(script)();
    expect(document.documentElement.dataset.theme).toBe(expected);
  });
});
