// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app, proxying /api); backend-running (real API on :4000 with the task-tags backend: tags, tagIds and the tag list filter); real-db
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

const PASSWORD = 'correct-horse-9';
const PHONE = { width: 360, height: 740 };
const THEMES = ['light', 'dark'] as const;
type Scheme = (typeof THEMES)[number];

const uniqueName = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Person {
  context: BrowserContext;
  page: Page;
}

/** A fresh browser context signed in as a new user with Home and Work tags and three tasks. */
async function personWithTags(browser: Browser, scheme: Scheme): Promise<Person> {
  const context = await browser.newContext({ colorScheme: scheme, viewport: PHONE });
  const page = await context.newPage();
  const registered = await page.request.post('/api/auth/register', {
    data: { username: uniqueName('tagfilter'), password: PASSWORD },
  });
  expect(registered.ok()).toBe(true);
  const ids = new Map<string, string>();
  for (const name of ['Home', 'Work']) {
    const made = await page.request.post('/api/tags', { data: { name } });
    expect(made.ok()).toBe(true);
    ids.set(name, ((await made.json()) as { tag: { id: string } }).tag.id);
  }
  const seed = [
    { title: 'Book dentist', tags: ['Home'] },
    { title: 'Send report', tags: ['Work'] },
    { title: 'Walk dog', tags: [] as string[] },
  ];
  for (const task of seed) {
    const created = await page.request.post('/api/tasks', {
      data: { title: task.title, tagIds: task.tags.map((name) => ids.get(name)) },
    });
    expect(created.ok()).toBe(true);
  }
  await page.goto('/');
  return { context, page };
}

/** Presses Tab until the target holds focus, as a keyboard user would; fails if it never does. */
async function tabTo(page: Page, target: Locator, limit = 60) {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if ((await target.and(page.locator(':focus')).count()) === 1) return;
  }
  throw new Error(`Tab never reached the target within ${limit} presses`);
}

const titlesShown = (page: Page) =>
  page.getByRole('listitem').getByText(/^(Book dentist|Send report|Walk dog)$/);
const tagSelect = (page: Page) => page.getByRole('combobox', { name: 'Tag' });

function filterTest(scheme: Scheme) {
  test(`choose a tag with the keyboard, select a chip, clear, and keep it after a reload (TAG04 AC-4 AC-5 AC-6 AC-7 AC-23, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWithTags(browser, scheme);
    await expect(titlesShown(page)).toHaveCount(3);

    await expect(tagSelect(page)).toBeVisible();
    await tabTo(page, tagSelect(page));
    // Escape on the select leaves the filter and the list as they were (TAG04 TS-27).
    await page.keyboard.press('Escape');
    await expect(tagSelect(page)).toHaveValue('any');
    await expect(titlesShown(page)).toHaveCount(3);
    await expect(tagSelect(page)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(tagSelect(page)).toHaveValue(/^[0-9a-f]{24}$/);
    await expect(titlesShown(page)).toHaveText(['Book dentist']);

    await page.reload();
    await expect(tagSelect(page)).toHaveValue(/^[0-9a-f]{24}$/);
    await expect(titlesShown(page)).toHaveText(['Book dentist']);

    await page.getByRole('button', { name: 'Clear filters' }).focus();
    await page.keyboard.press('Enter');
    await expect(titlesShown(page)).toHaveCount(3);
    await expect(tagSelect(page)).toHaveValue('any');

    const chip = page
      .getByRole('listitem')
      .filter({ hasText: 'Send report' })
      .getByRole('button', { name: 'Work' });
    await tabTo(page, chip);
    await page.keyboard.press('Enter');
    await expect(titlesShown(page)).toHaveText(['Send report']);
    await context.close();
  });

  test(`filter by No tags and see the empty state with Clear filters (TAG04 AC-2 AC-8, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWithTags(browser, scheme);
    await tagSelect(page).selectOption('none');
    await expect(titlesShown(page)).toHaveText(['Walk dog']);
    await page.getByRole('combobox', { name: 'Status' }).selectOption('completed');
    // The message is also announced in a live region; the visible one is the empty state's.
    const noMatch = page.locator('p.task-list-empty-text', {
      hasText: 'No tasks match your filters.',
    });
    await expect(noMatch).toBeVisible();
    // The empty state carries its own Clear filters, beside the filter bar's.
    await expect(
      noMatch.locator('..').getByRole('button', { name: 'Clear filters' }),
    ).toBeVisible();
    await context.close();
  });
}

for (const scheme of THEMES) {
  test.describe(`tag filter, ${scheme} theme at 360px`, () => {
    filterTest(scheme);
  });
}
