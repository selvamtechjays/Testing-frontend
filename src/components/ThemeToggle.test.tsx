// tier: component
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';

function stubScheme(dark: boolean) {
  let listener: (() => void) | undefined;
  const query = {
    matches: dark,
    addEventListener: (_: string, cb: () => void) => {
      listener = cb;
    },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(query));
  return {
    change(next: boolean) {
      query.matches = next;
      act(() => listener?.());
    },
  };
}

describe('ThemeToggle (Task-21 AC-2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('starts from the device scheme and exposes its state as aria-pressed', () => {
    stubScheme(true);
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('is not pressed when the device is light', () => {
    stubScheme(false);
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('click flips to the opposite explicit theme, applies it and remembers it', async () => {
    stubScheme(false);
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const toggle = screen.getByRole('button', { name: 'Dark mode' });
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('tasknest-theme')).toBe('dark');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('tasknest-theme')).toBe('light');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('is operable from the keyboard with Enter and Space', async () => {
    stubScheme(false);
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.keyboard(' ');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('follows a device scheme change while no choice is saved, but not once one is', () => {
    const scheme = stubScheme(false);
    render(<ThemeToggle />);
    const toggle = screen.getByRole('button', { name: 'Dark mode' });
    scheme.change(true);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    window.localStorage.setItem('tasknest-theme', 'light');
    scheme.change(false);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
