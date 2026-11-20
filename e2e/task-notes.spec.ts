// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app, proxying /api); backend-running (real API on :4000 with Task-24 notes on create and update); real-db
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

const PASSWORD = 'correct-horse-9';
const NOT_SAVED = 'Your changes to the notes were not saved.';
const NOTES = 'Call Ravi 98400 12345';
// Surface colour tokens from src/index.css, as the browser reports a computed background.
const SURFACE = { light: 'rgb(255, 255, 255)', dark: 'rgb(23, 23, 35)' } as const;

const uniqueName = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface SeedTask {
  title: string;
  notes?: string;
}

interface Person {
  context: BrowserContext;
  page: Page;
}

/** A fresh browser context signed in as a new user who owns exactly the given tasks. */
async function personWith(
  browser: Browser,
  prefix: string,
  tasks: SeedTask[],
  options: { colorScheme?: 'light' | 'dark'; viewport?: { width: number; height: number } } = {},
): Promise<Person> {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const registered = await page.request.post('/api/auth/register', {
    data: { username: uniqueName(prefix), password: PASSWORD },
  });
  expect(registered.ok()).toBe(true);
  for (const task of tasks) {
    const created = await page.request.post('/api/tasks', {
      data: { title: task.title, notes: task.notes },
    });
    expect(created.ok()).toBe(true);
  }
  await page.goto('/');
  return { context, page };
}

/** Presses Tab until the target holds focus, as a keyboard user would; fails if it never does. */
async function tabTo(page: Page, target: Locator, limit = 40) {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if ((await target.and(page.locator(':focus')).count()) === 1) return;
  }
  throw new Error(`Tab never reached the target within ${limit} presses`);
}

const rowFor = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title });
const notesButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `Notes for ${title}` });
const notesBox = (page: Page, title: string) =>
  page.getByRole('textbox', { name: `Notes for ${title}` });

/** Focus is on the page top; Tab to the row's Notes button and press Enter. */
async function openWithKeyboard(page: Page, title: string) {
  // Tab only after the list has loaded, or the presses are spent before the button exists.
  await expect(notesButton(page, title)).toBeVisible();
  await tabTo(page, notesButton(page, title));
  await page.keyboard.press('Enter');
  await expect(notesBox(page, title)).toBeFocused();
}

const THEMES = ['light', 'dark'] as const;
const PHONE = { width: 360, height: 740 };

type Scheme = (typeof THEMES)[number];

function editTests(scheme: Scheme) {
  test(`open, edit, save and see it after a reload (AC-6 AC-7 AC-10, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWith(
      browser,
      'notes',
      [{ title: 'Plain task' }, { title: 'Buy paint', notes: NOTES }],
      { colorScheme: scheme, viewport: PHONE },
    );
    await expect(rowFor(page, 'Buy paint')).toContainText('Has notes');
    await expect(rowFor(page, 'Plain task')).not.toContainText('Has notes');

    await openWithKeyboard(page, 'Buy paint');
    await expect(notesBox(page, 'Buy paint')).toHaveValue(NOTES);
    await expect(notesBox(page, 'Buy paint')).toHaveCSS('background-color', SURFACE[scheme]);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Call Ravi after 5');
    await tabTo(page, page.getByRole('button', { name: 'Save' }));
    await page.keyboard.press('Enter');

    await expect(page.getByRole('textbox', { name: /^Notes for / })).toHaveCount(0);
    await expect(notesButton(page, 'Buy paint')).toBeFocused();
    await expect(rowFor(page, 'Buy paint')).toContainText('Has notes');

    await page.reload();
    await openWithKeyboard(page, 'Buy paint');
    await expect(notesBox(page, 'Buy paint')).toHaveValue('Call Ravi after 5');
    await context.close();
  });

  test(`add notes to a task that had none (AC-1 AC-6, ${scheme})`, async ({ browser }) => {
    const { context, page } = await personWith(browser, 'addnote', [{ title: 'Plain task' }], {
      colorScheme: scheme,
      viewport: PHONE,
    });
    await openWithKeyboard(page, 'Plain task');
    await expect(page.getByRole('button', { name: 'Clear notes' })).toHaveCount(0);
    await page.keyboard.type('  ring the bell  ');
    await tabTo(page, page.getByRole('button', { name: 'Save' }));
    await page.keyboard.press('Enter');
    await expect(rowFor(page, 'Plain task')).toContainText('Has notes');
    await page.reload();
    await openWithKeyboard(page, 'Plain task');
    await expect(notesBox(page, 'Plain task')).toHaveValue('ring the bell');
    await context.close();
  });
}

function closeTests(scheme: Scheme) {
  test(`clear notes with the in-panel confirmation (AC-2 AC-6 AC-10, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWith(
      browser,
      'clear',
      [{ title: 'Buy paint', notes: NOTES }],
      { colorScheme: scheme, viewport: PHONE },
    );
    await openWithKeyboard(page, 'Buy paint');
    await tabTo(page, page.getByRole('button', { name: 'Clear notes' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: 'Clear these notes?' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Clear notes' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('textbox', { name: /^Notes for / })).toHaveCount(0);
    await expect(notesButton(page, 'Buy paint')).toBeFocused();
    await expect(rowFor(page, 'Buy paint')).not.toContainText('Has notes');
    await page.reload();
    await expect(rowFor(page, 'Buy paint')).not.toContainText('Has notes');
    await context.close();
  });

  test(`Escape closes without saving and says so when text was typed (AC-8, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWith(
      browser,
      'escape',
      [{ title: 'Buy paint', notes: NOTES }],
      { colorScheme: scheme, viewport: PHONE },
    );
    await openWithKeyboard(page, 'Buy paint');
    await page.keyboard.type(' extra');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: /^Notes for / })).toHaveCount(0);
    await expect(page.getByText(NOT_SAVED)).toBeVisible();
    await expect(notesButton(page, 'Buy paint')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(notesBox(page, 'Buy paint')).toHaveValue(NOTES);
    await page.keyboard.press('Escape');
    await expect(page.getByText(NOT_SAVED)).toHaveCount(0);
    await context.close();
  });
}

function limitTests(scheme: Scheme) {
  test(`stops at 1000 characters, shows what is left and never scrolls sideways (AC-9 AC-10, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'limit', [{ title: 'Buy paint' }], {
      colorScheme: scheme,
      viewport: PHONE,
    });
    await openWithKeyboard(page, 'Buy paint');
    await expect(page.getByText('1000 characters left')).toBeVisible();
    await notesBox(page, 'Buy paint').fill('a'.repeat(1200));
    expect(await notesBox(page, 'Buy paint').inputValue()).toHaveLength(1000);
    await expect(page.getByText('0 characters left').first()).toBeVisible();
    const overflow = await page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await tabTo(page, page.getByRole('button', { name: 'Save' }));
    await page.keyboard.press('Enter');
    await page.reload();
    await openWithKeyboard(page, 'Buy paint');
    expect(await notesBox(page, 'Buy paint').inputValue()).toHaveLength(1000);
    await context.close();
  });
}

for (const scheme of THEMES) {
  test.describe(`notes at 360px, ${scheme} theme, keyboard only`, () => {
    editTests(scheme);
    closeTests(scheme);
    limitTests(scheme);
  });
}

test.describe('only one panel at a time and title-only search (AC-8 AC-4)', () => {
  test('opening another task closes the first and reports a lost change (AC-8)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(
      browser,
      'switch',
      [{ title: 'Second task' }, { title: 'First task', notes: NOTES }],
      { viewport: PHONE },
    );
    await openWithKeyboard(page, 'First task');
    await page.keyboard.type('!');
    await tabTo(page, notesButton(page, 'Second task'));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: /^Notes for / })).toHaveCount(1);
    await expect(notesBox(page, 'Second task')).toBeFocused();
    await expect(page.getByText(NOT_SAVED)).toBeVisible();
    await context.close();
  });

  test('a word that appears only in the notes finds nothing (AC-4)', async ({ browser }) => {
    const { context, page } = await personWith(
      browser,
      'search',
      [{ title: 'Buy paint', notes: NOTES }],
      { viewport: PHONE },
    );
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill('Ravi');
    await expect(page.locator('.task-list-empty-text')).toHaveText('No tasks match your search.');
    await context.close();
  });
});
