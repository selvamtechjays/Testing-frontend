const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user's OS asks for reduced motion (false where the browser cannot tell). */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Mirrors the OS preference onto <html> so the CSS motion tokens drop to 0ms (index.css). */
export function applyMotionPreference(root: HTMLElement = document.documentElement): void {
  root.dataset.reducedMotion = String(prefersReducedMotion());
}

/**
 * Keeps <html data-reduced-motion> in step when the OS setting changes while the app is open.
 * Returns an unsubscribe function; a no-op where the browser cannot report changes.
 */
export function watchMotionPreference(root: HTMLElement = document.documentElement): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  if (typeof query.addEventListener !== 'function') return () => {};
  const onChange = () => applyMotionPreference(root);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * How long a removed element should stay on screen to animate out, read from the
 * `--duration-base` token so CSS and JS never disagree. 0 means "remove at once":
 * reduced motion, or no stylesheet loaded (as under the unit-test DOM).
 */
export function exitDurationMs(root: HTMLElement = document.documentElement): number {
  if (prefersReducedMotion()) return 0;
  const raw = getComputedStyle(root).getPropertyValue('--duration-base').trim();
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(raw);
  if (!match) return 0;
  const value = Number(match[1]);
  return match[2] === 's' ? value * 1000 : value;
}
