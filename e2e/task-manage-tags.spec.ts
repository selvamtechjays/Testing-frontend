// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app, proxying /api); backend-running (real API on :4000 with the task-tags backend: tag rename, recolour and delete); real-db
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

/** A fresh browser context signed in as a new user with Home and Work tags on three tasks. */
async function personWithTags(browser: Browser, scheme: Scheme): Promise<Person> {
  const context = await browser.newContext({ colorScheme: scheme, viewport: PHONE });
  const page = await context.newPage();
  const registered = await page.request.post('/api/auth/register', {
    data: { username: uniqueName('manage'), password: PASSWORD },
  });
  expect(registered.ok()).toBe(true);
  const ids = new Map<string, string>();
  for (const name of ['Home', 'Work']) {
    const made = await page.request.post('/api/tags', { data: { name } });
    expect(made.ok()).toBe(true);
    ids.set(name, ((await made.json()) as { tag: { id: string } }).tag.id);
  }
  const seed = [
    { title: 'Book dentist', tags: ['Home', 'Work'] },
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
async function tabTo(page: Page, target: Locator, limit = 80) {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if ((await target.and(page.locator(':focus')).count()) === 1) return;
  }
  throw new Error(`Tab never reached the target within ${limit} presses`);
}

const manageButton = (page: Page) => page.getByRole('button', { name: 'Manage tags' });
const rowFor = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title });
const nameBox = (page: Page, name: string) =>
  page.getByRole('textbox', { name: `Name of tag ${name}` });

function manageTest(scheme: Scheme) {
  test(`rename, recolour and delete a tag with the keyboard only at 360px (TAG02 AC-2 AC-3 AC-4 AC-5 AC-20 AC-21, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWithTags(browser, scheme);
    await expect(rowFor(page, 'Send report').getByText('Work')).toBeVisible();

    await expect(manageButton(page)).toBeVisible();
    await tabTo(page, manageButton(page));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Manage tags' })).toBeFocused();
    await expect(page.getByRole('group', { name: 'Tag Work' }).getByText('2 tasks')).toBeVisible();

    await nameBox(page, 'Work').focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Office');
    await page.keyboard.press('Enter');
    await expect(rowFor(page, 'Send report').getByText('Office')).toBeVisible();
    await expect(rowFor(page, 'Book dentist').getByText('Office')).toBeVisible();

    // Recolour by keyboard: Tab to the select and type the first letter of Purple.
    await tabTo(page, page.getByRole('combobox', { name: 'Colour of tag Office' }));
    await page.keyboard.press('p');
    await expect(rowFor(page, 'Send report').locator('.tag-chip--purple')).toHaveText('Office');

    await page.getByRole('button', { name: 'Delete tag Office' }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('It will be removed from 2 tasks. The tasks are kept.'),
    ).toBeVisible();
    await tabTo(page, page.getByRole('button', { name: 'Keep' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Delete tag Office' })).toBeFocused();
    await expect(rowFor(page, 'Send report').getByText('Office')).toBeVisible();

    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: 'Delete', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: 'Tag Office' })).toHaveCount(0);
    await expect(rowFor(page, 'Send report').getByText('Office')).toHaveCount(0);
    await expect(rowFor(page, 'Book dentist').getByText('Home')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: /Send report/ })).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: 'Manage tags' })).toHaveCount(0);
    await expect(manageButton(page)).toBeFocused();
    await page.reload();
    await expect(rowFor(page, 'Book dentist').getByText('Home')).toBeVisible();
    await expect(rowFor(page, 'Send report').getByText('Office')).toHaveCount(0);
    await context.close();
  });

  test(`a refused rename shows the server message beside the field and the panel fits 360px (TAG02 AC-9 AC-20, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWithTags(browser, scheme);
    await manageButton(page).click();
    await nameBox(page, 'Home').fill('work');
    await nameBox(page, 'Home').press('Enter');
    await expect(page.getByText('You already have a tag with that name.')).toBeVisible();
    await expect(rowFor(page, 'Book dentist').getByText('Home')).toBeVisible();
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await context.close();
  });
}

for (const scheme of THEMES) {
  test.describe(`manage tags, ${scheme} theme at 360px`, () => {
    manageTest(scheme);
  });
}
