// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app, proxying /api); backend-running (real API on :4000 with Task-22 search); real-db
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { test, expect } from './fixtures';

const PASSWORD = 'correct-horse-9';
const NO_MATCH = 'No tasks match your search.';

/** A unique username per run (3 to 30 letters, numbers, underscores) so reruns never collide. */
const uniqueName = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Person {
  context: BrowserContext;
  page: Page;
}

/** A fresh browser context signed in as a new user who owns exactly the given tasks. */
async function personWith(
  browser: Browser,
  prefix: string,
  titles: string[],
  options: { colorScheme?: 'light' | 'dark'; viewport?: { width: number; height: number } } = {},
): Promise<Person> {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const registered = await page.request.post('/api/auth/register', {
    data: { username: uniqueName(prefix), password: PASSWORD },
  });
  expect(registered.ok()).toBe(true);
  // Oldest first, so the newest-first list reads back in reverse.
  for (const title of titles) {
    const created = await page.request.post('/api/tasks', { data: { title } });
    expect(created.ok()).toBe(true);
  }
  await page.goto('/');
  return { context, page };
}

const titlesOnScreen = (page: Page) => page.getByRole('listitem');

test.describe('search tasks by title', () => {
  test('typing narrows the list and clearing restores it, ignoring capitals (AC-1 AC-2 AC-3 AC-6)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'srch', ['Pay rent', 'Buy milk']);
    await expect(titlesOnScreen(page)).toHaveCount(2);

    const box = page.getByRole('searchbox', { name: 'Search tasks' });
    await box.fill('milk');
    await expect(titlesOnScreen(page)).toHaveCount(1);
    await expect(titlesOnScreen(page).first()).toContainText('Buy milk');
    await expect(page.getByText('Pay rent')).toHaveCount(0);

    await box.fill('MILK');
    await expect(titlesOnScreen(page)).toHaveCount(1);
    await expect(titlesOnScreen(page).first()).toContainText('Buy milk');

    await box.fill('');
    await expect(titlesOnScreen(page)).toHaveCount(2);
    await expect(titlesOnScreen(page)).toContainText(['Buy milk', 'Pay rent']);
    await context.close();
  });

  test('shows the no-match text when nothing contains the search (AC-7)', async ({ browser }) => {
    const { context, page } = await personWith(browser, 'nomatch', ['Buy milk']);
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill('zzz');
    await expect(page.getByText(NO_MATCH).first()).toBeVisible();
    await expect(titlesOnScreen(page)).toHaveCount(0);
    await context.close();
  });

  test('regex characters are matched literally (AC-1)', async ({ browser }) => {
    const { context, page } = await personWith(browser, 'literal', ['Plan a+b', 'Plan aab']);
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill('a+b');
    await expect(titlesOnScreen(page)).toHaveCount(1);
    await expect(titlesOnScreen(page).first()).toContainText('Plan a+b');
    await context.close();
  });
});

test.describe('search privacy and keyboard use', () => {
  test('never shows another user their tasks, even for an exact title (AC-5)', async ({
    browser,
  }) => {
    const alice = await personWith(browser, 'alice', ['Secret milk plan']);
    const bob = await personWith(browser, 'bob', ['Buy bread']);
    const box = bob.page.getByRole('searchbox', { name: 'Search tasks' });
    await box.fill('milk');
    await expect(bob.page.getByText(NO_MATCH).first()).toBeVisible();
    await expect(bob.page.getByText('Secret milk plan')).toHaveCount(0);

    await alice.page.getByRole('searchbox', { name: 'Search tasks' }).fill('milk');
    await expect(titlesOnScreen(alice.page)).toHaveCount(1);
    await expect(alice.page.getByText('Buy bread')).toHaveCount(0);
    await alice.context.close();
    await bob.context.close();
  });

  test('is usable by keyboard alone, and Escape clears the box (AC-6 AC-8)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'kbd', ['Pay rent', 'Buy milk']);
    const box = page.getByRole('searchbox', { name: 'Search tasks' });
    await box.focus();
    await expect(box).toBeFocused();
    await page.keyboard.type('milk');
    await expect(titlesOnScreen(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(box).toHaveValue('');
    await expect(titlesOnScreen(page)).toHaveCount(2);
    await context.close();
  });
});

test.describe('search box layout', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`fits a 360px screen with no sideways scroll in ${colorScheme} mode, 44px tall (AC-8)`, async ({
      browser,
    }) => {
      const { context, page } = await personWith(browser, `w360${colorScheme}`, ['Buy milk'], {
        colorScheme,
        viewport: { width: 360, height: 740 },
      });
      const box = page.getByRole('searchbox', { name: 'Search tasks' });
      await expect(box).toBeVisible();
      // The box comes from Playwright's own measurement. The page's width is read with a string
      // expression that is a value, not a function: the e2e project has no DOM type library.
      const rect = await box.boundingBox();
      if (!rect) throw new Error('the search box has no size');
      const page360 = (await page.evaluate(
        '({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, width: document.documentElement.clientWidth })',
      )) as { overflow: boolean; width: number };
      const geometry = {
        height: rect.height,
        left: rect.x,
        right: rect.x + rect.width,
        ...page360,
      };
      expect(geometry.height).toBeGreaterThanOrEqual(44);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width);
      expect(geometry.overflow).toBe(false);

      await box.fill('zzz');
      await expect(page.getByText(NO_MATCH).first()).toBeVisible();
      await context.close();
    });
  }
});
