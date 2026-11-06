// tier: unit
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read from disk: Vite's css pipeline blanks `?raw` CSS imports under vitest.
const read = (relative: string) => readFileSync(resolve(__dirname, relative), 'utf8');
const indexHtml = read('../index.html');
const appCss = read('./App.css');
const indexCss = read('./index.css');

const MIN_TOUCH_TARGET = 'min-height: 44px';
const BASE_FONT_PERCENT = /font-size:\s*(\d+)%/;
const MIN_BASE_FONT_PERCENT = 100;

describe('platform baseline', () => {
  it('declares the document language as English (AC-4 BR-1 TS-4)', () => {
    expect(indexHtml).toMatch(/<html[^>]*\slang="en"/);
  });

  it('keeps a base font size of at least 16px (AC-5 BR-3 TS-5)', () => {
    const match = BASE_FONT_PERCENT.exec(indexCss);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(MIN_BASE_FONT_PERCENT);
  });

  it('styles a visible focus outline (AC-5 AC-7 BR-3 TS-5 TS-8)', () => {
    expect(indexCss).toContain(':focus-visible');
    expect(indexCss).toMatch(/outline:\s*3px solid/);
  });

  it('keeps a 44px minimum touch target on inputs and buttons (AC-3 AC-5 BR-3 TS-3)', () => {
    expect(appCss).toContain(MIN_TOUCH_TARGET);
  });

  it('uses one mobile-first breakpoint (AC-3 BR-2 TS-3)', () => {
    const queries = appCss.match(/@media[^{]+/g) ?? [];
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('min-width');
  });

  it('has no dark-mode switch or brand artwork in the base styles (AC-10 BR-4 TS-11)', () => {
    expect(indexCss + appCss).not.toMatch(/prefers-color-scheme|background-image|url\(/);
  });
});
