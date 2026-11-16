// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app); backend stubbed with page.route
import type { Browser, BrowserContextOptions, Page } from '@playwright/test';
import { test, expect } from './fixtures';

// String expressions: the e2e project has no DOM type library, the browser evaluates these.
const readToken = (page: Page, token: string) =>
  page.evaluate(`getComputedStyle(document.documentElement).getPropertyValue('${token}').trim()`);

const SIGNED_OUT = {
  status: 401,
  contentType: 'application/json',
  body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Not signed in.' } }),
};

/** Signed out everywhere: the session check never reaches a backend that is not running. */
const newContext = async (browser: Browser, options: BrowserContextOptions = {}) => {
  const context = await browser.newContext(options);
  await context.route('**/api/auth/me', (route) => route.fulfill(SIGNED_OUT));
  return context;
};

const DARK_BG = '#0f0f17';
const LIGHT_BG = '#ffffff';

test('follows a dark device by default (Task-21 AC-2)', async ({ browser }) => {
  const context = await newContext(browser, { colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/signin');
  await page.locator('.auth-orb').first().waitFor({ state: 'attached' });
  expect(await readToken(page, '--color-bg')).toBe(DARK_BG);
  await context.close();
});

test('follows a light device by default (Task-21 AC-2)', async ({ browser }) => {
  const context = await newContext(browser, { colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('/signin');
  await page.locator('.auth-orb').first().waitFor({ state: 'attached' });
  expect(await readToken(page, '--color-bg')).toBe(LIGHT_BG);
  await context.close();
});

test('toggle overrides the device and the choice survives a reload (Task-21 AC-2)', async ({
  browser,
}) => {
  const context = await newContext(browser, { colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('/signin');
  await page.locator('.auth-orb').first().waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await readToken(page, '--color-bg')).toBe(DARK_BG);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await context.close();
});

test('the saved theme is applied by the anti-flash script alone, with the app bundle blocked (Task-21 AC-2 no flash)', async ({
  browser,
}) => {
  const context = await newContext(browser, { colorScheme: 'light' });
  await context.addInitScript("window.localStorage.setItem('tasknest-theme', 'dark');");
  // Block every app script (built chunks, dev modules, the dev client) but not /theme-init.js,
  // so only the script in <head> can have set the theme.
  await context.route(/\/(assets\/.*\.js|src\/.*|@vite\/.*)(\?.*)?$/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto('/signin');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await readToken(page, '--color-bg')).toBe(DARK_BG);
  // Nothing rendered: the app really did not run.
  await expect(page.locator('#root')).toBeEmpty();
  await context.close();
});

test('reduced motion stops the ambient animation (Task-21 AC-5)', async ({ browser }) => {
  const context = await newContext(browser, { reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/signin');
  await page.locator('.auth-orb').first().waitFor({ state: 'attached' });
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  const name = await page.evaluate(
    "getComputedStyle(document.querySelector('.auth-orb')).animationName",
  );
  expect(name).toBe('none');
  await context.close();
});

test('reduced motion applies live when the device setting changes (Task-21 AC-5)', async ({
  browser,
}) => {
  const context = await newContext(browser, { reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto('/signin');
  await page.locator('.auth-orb').first().waitFor({ state: 'attached' });
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  const name = await page.evaluate(
    "getComputedStyle(document.querySelector('.auth-orb')).animationName",
  );
  expect(name).toBe('none');
  await context.close();
});

test('keeps a 44px toggle and no sideways scroll at 360px wide (Task-21 AC-6)', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) => route.fulfill(SIGNED_OUT));
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/signin');
  await page.locator('.auth-orb').first().waitFor({ state: 'attached' });
  const box = await page.getByRole('button', { name: 'Dark mode' }).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(360);
});
