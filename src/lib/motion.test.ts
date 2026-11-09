// tier: unit
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyMotionPreference, exitDurationMs, prefersReducedMotion } from './motion';

const stubMatchMedia = (matches: boolean) =>
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }));

describe('motion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty('--duration-base');
    delete document.documentElement.dataset.reducedMotion;
  });

  it('reads no preference where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('mirrors the OS preference onto <html> (index.css drops the durations to 0ms)', () => {
    stubMatchMedia(true);
    applyMotionPreference();
    expect(document.documentElement.dataset.reducedMotion).toBe('true');
    stubMatchMedia(false);
    applyMotionPreference();
    expect(document.documentElement.dataset.reducedMotion).toBe('false');
  });

  it('reads the exit duration from the --duration-base token, in ms or s', () => {
    stubMatchMedia(false);
    const root = document.documentElement;
    root.style.setProperty('--duration-base', '200ms');
    expect(exitDurationMs(root)).toBe(200);
    root.style.setProperty('--duration-base', '0.3s');
    expect(exitDurationMs(root)).toBe(300);
  });

  it('removes at once under reduced motion or with no token loaded', () => {
    const root = document.documentElement;
    stubMatchMedia(false);
    expect(exitDurationMs(root)).toBe(0);
    root.style.setProperty('--duration-base', '200ms');
    stubMatchMedia(true);
    expect(exitDurationMs(root)).toBe(0);
  });
});
