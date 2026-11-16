// tier: unit
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// CSS standard §23 (DEC-110), dark palette per DEC-200. Read from disk: Vite's css pipeline blanks `?raw` CSS under vitest.
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

const DARK_MEDIA = '@media (prefers-color-scheme: dark)';
const DARK_SYSTEM_BLOCK =
  /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme='light'\]\)\s*\{([^}]*)\}\s*\}/;
const DARK_EXPLICIT_BLOCK = /:root\[data-theme='dark'\]\s*\{([^}]*)\}/;

// Everything except token blocks (tokens are the only place raw colours may live). Every file may
// declare a bare `:root { }`; only index.css may also hold the DEC-200 dark blocks and the
// reduced-motion token block.
const BARE_ROOT = /(^|[}\s])\s*:root\s*\{[^}]*\}/g;
const INDEX_ONLY_ROOT_BLOCKS =
  /(^|[}\s])\s*:root\[data-(?:theme='dark'|reduced-motion='true')\]\s*\{[^}]*\}/g;
const outsideRoot = (css: string, name: string) => {
  const bare = css.replace(BARE_ROOT, '$1');
  if (name !== 'index.css') return bare;
  return bare
    .replace(new RegExp(DARK_SYSTEM_BLOCK.source, 'g'), '')
    .replace(INDEX_ONLY_ROOT_BLOCKS, '$1');
};

const RAW_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i;
const NAMED_COLOUR_VALUE =
  /(?:^|[\s:])(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|navy|teal|silver|maroon)\b(?=[^{]*;)/i;

const indexCss = files.find((f) => f.name === 'index.css')?.css ?? '';
const lightBlock = /:root\s*\{([^}]*)\}/.exec(indexCss)?.[1] ?? '';
const darkSystemBlock = DARK_SYSTEM_BLOCK.exec(indexCss)?.[1] ?? '';
const darkExplicitBlock = DARK_EXPLICIT_BLOCK.exec(indexCss)?.[1] ?? '';

const declarations = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/(--[\w-]+|color-scheme):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.replace(/\s+/g, ' ').trim(),
    ]),
  );

describe('CSS standard §23 (DEC-110)', () => {
  it('finds the stylesheets it is meant to police', () => {
    const names = files.map((f) => f.name);
    expect(names).toContain('index.css');
    expect(names).toContain('App.css');
  });

  it('declares the design tokens on :root in index.css (CSS-FE-001)', () => {
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
      // ui-standards.md §2: the six scales
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
      // premium redesign (Task-21)
      '--color-accent',
      '--color-accent-hover',
      '--color-accent-active',
      '--gradient-brand-hover',
      '--gradient-brand-active',
      '--shadow-focus-glow',
      '--opacity-ambient',
      '--blur-orb',
      '--color-header-bg',
      '--color-glow',
      '--gradient-brand',
      '--gradient-canvas',
      '--shadow-hover',
      '--blur-header',
      '--font-family-base',
      '--font-size-3xl',
      '--line-height-3xl',
      '--duration-slow',
      '--ease-emphasized',
      '--ease-spring',
      '--stagger-step',
    ]) {
      expect(lightBlock, token).toContain(`${token}:`);
    }
  });

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s has no raw colour literals outside token blocks (CSS-FE-001)',
    (name, css) => {
      const body = outsideRoot(css, name);
      expect(body).not.toMatch(RAW_COLOUR);
      expect(body).not.toMatch(NAMED_COLOUR_VALUE);
    },
  );

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s uses only the 48rem min-width breakpoint (CSS-FE-007)',
    (name, css) => {
      const queries = (css.match(/@media[^{]+/g) ?? []).map((q) => q.replace(/\s+/g, ' ').trim());
      for (const query of queries) {
        // DEC-200: the one dark-palette query, in index.css only
        if (name === 'index.css' && query === DARK_MEDIA) continue;
        expect(query).toBe('@media (min-width: 48rem)');
      }
    },
  );

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s never removes the focus outline (CSS-FE-006)',
    (_name, css) => {
      expect(css).not.toMatch(/outline:\s*(none|0)\b/);
    },
  );

  it.each(files.filter((f) => f.name !== 'index.css').map((f) => [f.name, f.css] as const))(
    '%s contains no colour-scheme query or theme attribute: dark lives in index.css tokens only (CSS-FE-010, DEC-200)',
    (_name, css) => {
      expect(css).not.toMatch(/prefers-color-scheme/);
      expect(css).not.toMatch(/data-theme/);
    },
  );

  it('index.css holds exactly the two DEC-200 dark blocks, with identical palettes', () => {
    expect(indexCss.match(/prefers-color-scheme/g)).toHaveLength(1);
    expect(darkSystemBlock).not.toBe('');
    expect(darkExplicitBlock).not.toBe('');
    expect(declarations(darkSystemBlock)).toEqual(declarations(darkExplicitBlock));
    expect(declarations(darkExplicitBlock)['color-scheme']).toBe('dark');
    expect(declarations(lightBlock)['color-scheme']).toBe('light');
    // every colour the light theme defines is redefined for dark
    const lightColours = Object.keys(declarations(lightBlock)).filter((n) =>
      n.startsWith('--color-'),
    );
    for (const name of lightColours) {
      expect(declarations(darkExplicitBlock), name).toHaveProperty(name);
    }
  });

  it('keeps the 3px focus ring token and uses it for every outline (CSS-FE-006)', () => {
    expect(lightBlock).toMatch(/--focus-ring:\s*3px solid var\(--color-focus\)/);
    expect(lightBlock).toMatch(/--control-height:\s*(?:4[4-9]|[5-9]\d)px/);
    expect(indexCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)/);
    for (const { name, css } of files) {
      for (const [, value] of outsideRoot(css, name).matchAll(/(?:^|[;{\s])outline:\s*([^;}]+)/g)) {
        expect(value.trim(), name).toBe('var(--focus-ring)');
      }
    }
  });

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s keeps px to borders, the control height and the focus outline (CSS-FE-005)',
    (name, css) => {
      const body = outsideRoot(css, name);
      const pxLines = body
        .split('\n')
        .filter((line) => /\d(?:\.\d+)?px/.test(line))
        .filter((line) => !/^\s*(?:outline|border)[\w-]*:/.test(line));
      expect(pxLines).toEqual([]);
    },
  );

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s has no inline timings: transitions and animations use the motion tokens (ui-standards §2)',
    (name, css) => {
      expect(outsideRoot(css, name)).not.toMatch(/\b\d+(?:\.\d+)?m?s\b/);
    },
  );

  it('lets reduced motion zero every duration and the stagger (AC-5)', () => {
    const block = /:root\[data-reduced-motion='true'\]\s*\{([^}]*)\}/.exec(indexCss)?.[1] ?? '';
    for (const token of [
      '--duration-fast',
      '--duration-base',
      '--duration-slow',
      '--stagger-step',
    ]) {
      expect(block, token).toMatch(new RegExp(`${token}:\\s*0ms`));
    }
  });

  it.each(files.map((f) => [f.name, f.css] as const))(
    '%s uses kebab-case class names and no ID selectors (CSS-FE-004)',
    (name, css) => {
      const selectors = outsideRoot(css, name).replace(/\{[^}]*\}/g, ' ');
      expect(selectors).not.toMatch(/#[a-z_-][\w-]*/i);
      for (const [, name] of selectors.matchAll(/\.([\w-]+)/g)) {
        expect(name).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/);
      }
    },
  );

  describe.each([
    ['light', lightBlock],
    ['dark', darkExplicitBlock],
    ['dark (system)', darkSystemBlock],
  ])('%s palette meets WCAG AA (CSS-FE-009, AC-3)', (_theme, block) => {
    const colour = (token: string) =>
      new RegExp(`${token}:\\s*#([0-9a-f]{6})`, 'i').exec(block)?.[1] ?? '';
    const channel = (hex: string, at: number) => {
      const value = parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (hex: string) =>
      0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 2) + 0.0722 * channel(hex, 4);
    const ratio = (a: string, b: string) => {
      expect(colour(a), a).not.toBe('');
      expect(colour(b), b).not.toBe('');
      const [light, dark] = [luminance(colour(a)), luminance(colour(b))].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const BODY = 4.5;
    const UI = 3;

    it.each([
      ['--color-text', '--color-bg'],
      ['--color-text', '--color-surface'],
      ['--color-muted', '--color-bg'],
      ['--color-muted', '--color-surface'],
      ['--color-muted', '--color-canvas'],
      ['--color-muted', '--color-subtle'],
      ['--color-danger', '--color-bg'],
      ['--color-danger', '--color-danger-subtle'],
      ['--color-success', '--color-bg'],
      ['--color-success', '--color-success-subtle'],
      ['--color-on-primary', '--color-primary'],
      ['--color-on-primary', '--color-primary-hover'],
      ['--color-on-primary', '--color-primary-active'],
      ['--color-on-primary', '--color-accent'],
      ['--color-on-primary', '--color-accent-hover'],
      ['--color-on-primary', '--color-accent-active'],
      ['--color-text', '--color-canvas'],
      ['--color-text', '--color-subtle'],
      ['--color-danger-hover', '--color-bg'],
      ['--color-danger-hover', '--color-surface'],
      ['--color-danger-hover', '--color-danger-subtle'],
      ['--color-primary', '--color-bg'],
      ['--color-primary', '--color-surface'],
      ['--color-primary-hover', '--color-bg'],
      ['--color-accent', '--color-bg'],
      ['--color-disabled', '--color-disabled-bg'],
    ])('text pair %s on %s is at least 4.5:1', (fg, bg) => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(BODY);
    });

    it.each(['--color-text', '--color-muted'])(
      'text %s on the frosted header (header-bg over canvas) is at least 4.5:1',
      (fg) => {
        const rgb = (hex: string) => [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
        const header = /--color-header-bg:\s*rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/.exec(block);
        expect(header, 'header-bg').not.toBeNull();
        const alpha = Number(header![4]) / 100;
        const over = rgb(colour('--color-canvas'));
        const composite = [1, 2, 3]
          .map((i) => Math.round(Number(header![i]) * alpha + over[i - 1] * (1 - alpha)))
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('');
        const [light, dark] = [luminance(colour(fg)), luminance(composite)].sort((x, y) => y - x);
        expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(BODY);
      },
    );

    it.each([
      ['--color-border-strong', '--color-bg'],
      ['--color-border', '--color-bg'],
      ['--color-border', '--color-surface'],
      ['--color-focus', '--color-bg'],
      ['--color-focus', '--color-surface'],
    ])('boundary pair %s on %s is at least 3:1', (fg, bg) => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(UI);
    });
  });
});
