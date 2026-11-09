// tier: unit
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// CSS standard §23 (DEC-110). Read from disk: Vite's css pipeline blanks `?raw` CSS under vitest.
const SRC = __dirname;

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith('.css') ? [full] : [];
  });
}

const files = cssFiles(SRC).map((path) => ({
  name: relative(SRC, path).split(sep).join('/'),
  css: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
}));

// Everything except `:root { ... }` blocks (tokens are the only place raw colours may live).
const outsideRoot = (css: string) => css.replace(/(^|\})\s*:root\s*\{[^}]*\}/g, '$1');

const RAW_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i;
const NAMED_COLOUR_VALUE =
  /(?:^|[\s:])(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|navy|teal|silver|maroon)\b(?=[^{]*;)/i;

describe('CSS standard §23 (DEC-110)', () => {
  it('finds the stylesheets it is meant to police', () => {
    const names = files.map((f) => f.name);
    expect(names).toContain('index.css');
    expect(names).toContain('App.css');
  });

  it('declares the design tokens on :root in index.css (CSS-FE-001)', () => {
    const indexCss = files.find((f) => f.name === 'index.css')?.css ?? '';
    const rootBlock = /:root\s*\{([^}]*)\}/.exec(indexCss)?.[1] ?? '';
    for (const token of [
      '--color-text',
      '--color-bg',
      '--color-primary',
      '--color-danger',
      '--color-success',
      '--color-border',
      '--color-muted',
      '--space-1',
      '--space-4',
      '--radius',
      '--control-height',
      // ui-standards.md �2: the six scales
      '--space-6',
      '--font-size-base',
      '--line-height-base',
      '--font-size-xl',
      '--font-size-2xl',
      '--font-weight-semibold',
      '--radius-sm',
      '--radius-md',
      '--radius-full',
      '--shadow-raised',
      '--shadow-overlay',
      '--duration-fast',
      '--duration-base',
      '--ease-standard',
    ]) {
      expect(rootBlock, token).toContain(`${token}:`);
    }
  });

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s has no raw colour literals outside :root (CSS-FE-001)',
    (_name, css) => {
      const body = outsideRoot(css);
      expect(body).not.toMatch(RAW_COLOUR);
      expect(body).not.toMatch(NAMED_COLOUR_VALUE);
    },
  );

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s uses only the 48rem min-width breakpoint (CSS-FE-007)',
    (_name, css) => {
      const queries = css.match(/@media[^{]+/g) ?? [];
      for (const query of queries) {
        expect(query.replace(/\s+/g, ' ').trim()).toBe('@media (min-width: 48rem)');
      }
    },
  );

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s has no dark-mode query and never removes the focus outline (CSS-FE-006, CSS-FE-010)',
    (_name, css) => {
      expect(css).not.toMatch(/prefers-color-scheme/);
      expect(css).not.toMatch(/outline:\s*(none|0)\b/);
    },
  );

  it('keeps the 3px focus ring token and uses it for every outline (CSS-FE-006)', () => {
    const indexCss = files.find((f) => f.name === 'index.css')?.css ?? '';
    const rootBlock = /:root\s*\{([^}]*)\}/.exec(indexCss)?.[1] ?? '';
    expect(rootBlock).toMatch(/--focus-ring:\s*3px solid var\(--color-focus\)/);
    expect(rootBlock).toMatch(/--control-height:\s*(?:4[4-9]|[5-9]\d)px/);
    expect(indexCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)/);
    for (const { name, css } of files) {
      for (const [, value] of outsideRoot(css).matchAll(/(?:^|[;{\s])outline:\s*([^;}]+)/g)) {
        expect(value.trim(), name).toBe('var(--focus-ring)');
      }
    }
  });

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s keeps px to borders, the control height and the focus outline (CSS-FE-005)',
    (_name, css) => {
      const body = outsideRoot(css);
      const pxLines = body
        .split('\n')
        .filter((line) => /\d(?:\.\d+)?px/.test(line))
        .filter((line) => !/^\s*(?:outline|border)[\w-]*:/.test(line));
      expect(pxLines).toEqual([]);
    },
  );

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s has no inline timings: transitions and animations use the motion tokens (ui-standards §2)',
    (_name, css) => {
      const body = outsideRoot(css).replace(/:root\[[^\]]*\]\s*\{[^}]*\}/g, '');
      expect(body).not.toMatch(/\b\d+(?:\.\d+)?m?s\b/);
    },
  );

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s uses kebab-case class names and no ID selectors (CSS-FE-004)',
    (_name, css) => {
      const selectors = outsideRoot(css).replace(/\{[^}]*\}/g, ' ');
      expect(selectors).not.toMatch(/#[a-z_-][\w-]*/i);
      for (const [, name] of selectors.matchAll(/\.([\w-]+)/g)) {
        expect(name).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/);
      }
    },
  );

  it('token text and background pairs meet WCAG AA (CSS-FE-009)', () => {
    const indexCss = files.find((f) => f.name === 'index.css')?.css ?? '';
    const rootBlock = /:root\s*\{([^}]*)\}/.exec(indexCss)?.[1] ?? '';
    const colour = (token: string) =>
      new RegExp(`${token}:\\s*#([0-9a-f]{6})`, 'i').exec(rootBlock)?.[1] ?? '';
    const channel = (hex: string, at: number) => {
      const value = parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (hex: string) =>
      0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 2) + 0.0722 * channel(hex, 4);
    const ratio = (a: string, b: string) => {
      const [light, dark] = [luminance(colour(a)), luminance(colour(b))].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const BODY = 4.5;
    const UI = 3;
    expect(ratio('--color-text', '--color-bg')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-muted', '--color-bg')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-danger', '--color-bg')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-success', '--color-bg')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-on-primary', '--color-primary')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-border-strong', '--color-bg')).toBeGreaterThanOrEqual(UI);
    // ui-standards.md �3: control boundaries meet the 3:1 non-text floor (WCAG 2.2 1.4.11)
    expect(ratio('--color-border', '--color-bg')).toBeGreaterThanOrEqual(UI);
    expect(ratio('--color-on-primary', '--color-primary-hover')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-danger', '--color-danger-subtle')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-success', '--color-success-subtle')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-muted', '--color-canvas')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-disabled', '--color-disabled-bg')).toBeGreaterThanOrEqual(BODY);
    expect(ratio('--color-focus', '--color-bg')).toBeGreaterThanOrEqual(UI);
  });
});
