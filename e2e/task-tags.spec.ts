// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app, proxying /api); backend-running (real API on :4000 with the task-tags backend: tags and tagIds); real-db
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

const PASSWORD = 'correct-horse-9';
const PHONE = { width: 360, height: 740 };
const THEMES = ['light', 'dark'] as const;
type Scheme = (typeof THEMES)[number];
const AA_TEXT = 4.5;

const uniqueName = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Person {
  context: BrowserContext;
  page: Page;
}

interface Seed {
  tags: string[];
  /** Titles of tasks to create; each carries the tags listed for it by name. */
  tasks: Array<{ title: string; tags?: string[] }>;
}

/** A fresh browser context signed in as a new user who owns exactly the seeded tags and tasks. */
async function personWith(browser: Browser, seed: Seed, scheme: Scheme): Promise<Person> {
  const context = await browser.newContext({ colorScheme: scheme, viewport: PHONE });
  const page = await context.newPage();
  const registered = await page.request.post('/api/auth/register', {
    data: { username: uniqueName('tags'), password: PASSWORD },
  });
  expect(registered.ok()).toBe(true);
  const ids = new Map<string, string>();
  for (const name of seed.tags) {
    const made = await page.request.post('/api/tags', { data: { name } });
    expect(made.ok()).toBe(true);
    ids.set(name, ((await made.json()) as { tag: { id: string } }).tag.id);
  }
  for (const task of seed.tasks) {
    const tagIds = (task.tags ?? []).map((name) => ids.get(name));
    const created = await page.request.post('/api/tasks', { data: { title: task.title, tagIds } });
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
const tagsButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `Tags for ${title}` });

/** Tab to the row's Tags button and press Enter; the picker opens and takes focus. */
async function openPickerWithKeyboard(page: Page, title: string) {
  await expect(tagsButton(page, title)).toBeVisible();
  await tabTo(page, tagsButton(page, title));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: `Tags panel for ${title}` })).toBeVisible();
}

/** Relative luminance and contrast ratio of two computed `rgb(...)` colours. */
function contrast(a: string, b: string): number {
  const lum = (css: string) => {
    const [r, g, bl] = (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const lin = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function createTest(scheme: Scheme) {
  test(`create a tag and tick it with the keyboard only, and see it after a reload (TAG03 AC-7 AC-27 AC-30, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWith(
      browser,
      { tags: [], tasks: [{ title: 'Plan trip' }] },
      scheme,
    );
    await openPickerWithKeyboard(page, 'Plan trip');
    await expect(page.getByRole('textbox', { name: 'Create tag' })).toBeFocused();
    await page.keyboard.type('Groceries');
    await page.keyboard.press('Enter');
    await expect(rowFor(page, 'Plan trip').getByText('Groceries').first()).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Groceries' })).toBeChecked();

    await page.keyboard.press('Escape');
    await expect(tagsButton(page, 'Plan trip')).toBeFocused();
    await page.reload();
    await expect(rowFor(page, 'Plan trip').getByText('Groceries')).toBeVisible();
    await context.close();
  });
}

function tickTest(scheme: Scheme) {
  test(`tick and untick existing tags with the keyboard only (TAG03 AC-6 AC-30, ${scheme})`, async ({
    browser,
  }) => {
    const { context, page } = await personWith(
      browser,
      { tags: ['Home', 'Work'], tasks: [{ title: 'Book dentist' }] },
      scheme,
    );
    // Count the tag saves the server answers: tick Home, tick Work, untick Work.
    let saved = 0;
    page.on('response', (response) => {
      const request = response.request();
      if (request.method() === 'PATCH' && request.url().includes('/api/tasks/')) saved += 1;
    });
    await openPickerWithKeyboard(page, 'Book dentist');
    await expect(page.getByRole('checkbox', { name: 'Home' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(rowFor(page, 'Book dentist').getByText('Home').first()).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox', { name: 'Work' })).not.toBeChecked();
    // The saves go out one at a time; reload only once all three are answered and the server
    // holds the last (its end state, Home alone, is also what the first save left).
    await expect.poll(() => saved).toBe(3);
    await expect
      .poll(async () => {
        const answer = await page.request.get('/api/tasks');
        const { tasks } = (await answer.json()) as {
          tasks: Array<{ tags: Array<{ name: string }> }>;
        };
        return tasks[0]?.tags.map((tag) => tag.name);
      })
      .toEqual(['Home']);
    await page.reload();
    await expect(rowFor(page, 'Book dentist').getByText('Home')).toBeVisible();
    await expect(rowFor(page, 'Book dentist').getByText('Work')).toHaveCount(0);
    await context.close();
  });
}

function wrapTest(scheme: Scheme) {
  test(`five chips with a long name wrap at 360px, keep their names and meet contrast (TAG03 AC-30 BR-12, ${scheme})`, async ({
    browser,
  }) => {
    // Wide letters, so 30 of them are longer than the row and the chip has to shorten.
    const long = 'W'.repeat(30);
    const names = ['Home', 'Work', 'Errands', 'Health', long];
    const { context, page } = await personWith(
      browser,
      { tags: names, tasks: [{ title: 'Busy task', tags: names }] },
      scheme,
    );
    const row = rowFor(page, 'Busy task');
    for (const name of names) await expect(row.getByText(name, { exact: true })).toBeVisible();
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The chips wrap onto more than one line, and the long one ends in an ellipsis, its
    // full name still its accessible name and tooltip (TAG04 AC-21 BR-11).
    // Strings, as this project's e2e has no DOM types; evaluated in the page.
    const chipsIn = (title: string) =>
      `Array.from(document.querySelectorAll('li')).find((li) => li.textContent.includes(${JSON.stringify(title)})).querySelectorAll('.tag-chip')`;
    const tops = await page.evaluate<number[]>(
      `Array.from(${chipsIn('Busy task')}).map((chip) => chip.getBoundingClientRect().top)`,
    );
    expect(new Set(tops.map((top) => Math.round(top))).size).toBeGreaterThan(1);
    const longChip = row.locator('.tag-chip').filter({ hasText: long });
    const cut = await page.evaluate<{ scroll: number; client: number; overflow: string }>(
      `(() => { const chip = Array.from(${chipsIn('Busy task')}).find((c) => c.textContent === ${JSON.stringify(long)}); return { scroll: chip.scrollWidth, client: chip.clientWidth, overflow: getComputedStyle(chip).textOverflow }; })()`,
    );
    expect(cut.overflow).toBe('ellipsis');
    expect(cut.scroll).toBeGreaterThan(cut.client);
    await expect(longChip).toHaveAttribute('title', long);

    // The theme really is the one under test: its surface token, not only the emulated scheme.
    const bg = await page.evaluate<string>(
      "getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()",
    );
    expect(bg).toBe(scheme === 'dark' ? '#0f0f17' : '#ffffff');

    const colours = await page.evaluate<Array<{ fg: string; bg: string }>>(
      `Array.from(${chipsIn('Busy task')}).map((chip) => { const s = getComputedStyle(chip); return { fg: s.color, bg: s.backgroundColor }; })`,
    );
    expect(colours).toHaveLength(5);
    for (const { fg, bg } of colours) expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    await context.close();
  });
}

function journeyTests(scheme: Scheme) {
  createTest(scheme);
  tickTest(scheme);
  wrapTest(scheme);
}

for (const scheme of THEMES) {
  test.describe(`task tags, ${scheme} theme at 360px`, () => journeyTests(scheme));
}
