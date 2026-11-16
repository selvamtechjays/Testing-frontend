// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app, proxying /api); backend-running (real API on :4000 with Task-22 search and Task-23 due dates, priority and filters); real-db
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

const PASSWORD = 'correct-horse-9';
const NO_FILTER_MATCH = 'No tasks match your filters.';

/** A unique username per run (3 to 30 letters, numbers, underscores) so reruns never collide. */
const uniqueName = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface SeedTask {
  title: string;
  dueDate?: string | null;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
}

interface ContextOptions {
  colorScheme?: 'light' | 'dark';
  viewport?: { width: number; height: number };
  timezoneId?: string;
  /** The browser clock is frozen at this instant (an ISO string with an offset). */
  now?: string;
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
  options: ContextOptions = {},
): Promise<Person> {
  const { now, ...contextOptions } = options;
  const context = await browser.newContext(contextOptions);
  if (now) await context.clock.setFixedTime(new Date(now));
  const page = await context.newPage();
  const registered = await page.request.post('/api/auth/register', {
    data: { username: uniqueName(prefix), password: PASSWORD },
  });
  expect(registered.ok()).toBe(true);
  // Oldest first, so the newest-first list reads back in reverse.
  for (const task of tasks) {
    const created = await page.request.post('/api/tasks', {
      data: { title: task.title, dueDate: task.dueDate, priority: task.priority },
    });
    expect(created.ok()).toBe(true);
    if (task.completed) {
      const { task: stored } = (await created.json()) as { task: { id: string } };
      const patched = await page.request.patch(`/api/tasks/${stored.id}`, {
        data: { status: 'completed' },
      });
      expect(patched.ok()).toBe(true);
    }
  }
  await page.goto('/');
  return { context, page };
}

/**
 * The keys that type a calendar date into the browser's native date box. The box orders its parts by
 * the machine's region (month first on one, day first on another), so a probe box is typed with a
 * known date once and the order it reads back decides the key order. Still keyboard-only.
 */
async function dateKeys(context: BrowserContext, year: number, month: number, day: number) {
  const probe = await context.newPage();
  await probe.setContent('<input type="date" id="probe">');
  await probe.locator('#probe').focus();
  await probe.keyboard.type('01022026');
  const read = await probe.locator('#probe').inputValue();
  await probe.close();
  const two = (n: number) => String(n).padStart(2, '0');
  const monthFirst = read === '2026-01-02';
  return (monthFirst ? two(month) + two(day) : two(day) + two(month)) + String(year);
}

const rows = (page: Page) => page.getByRole('listitem');
const select = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Filter and sort tasks' }).getByRole('combobox', { name });
const rowFor = (page: Page, title: string) => rows(page).filter({ hasText: title });

/** Types a date into a row's date box and leaves the box, which is what saves it. */
async function setRowDate(page: Page, title: string, value: string) {
  const box = page.getByLabel(`Due date for ${title}`);
  await box.fill(value);
  await box.blur();
}

/** Presses Tab until the target holds focus, as a keyboard user would; fails if it never does. */
async function tabTo(page: Page, target: Locator, limit = 30) {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if ((await target.and(page.locator(':focus')).count()) === 1) return;
  }
  throw new Error(`Tab never reached the target within ${limit} presses`);
}

const CALENDAR_SEED: SeedTask[] = [
  { title: 'Past due', dueDate: '2026-11-15', priority: 'high' },
  { title: 'Done late', dueDate: '2026-11-10', completed: true },
  { title: 'Due now', dueDate: '2026-11-16' },
  { title: 'Week end', dueDate: '2026-11-22', priority: 'low' },
  { title: 'Next week', dueDate: '2026-11-23' },
  { title: 'No date' },
];

// "Today" for the date-boundary specs: 16 Nov 2026, local noon in Los Angeles (UTC-8).
const LA = { timezoneId: 'America/Los_Angeles', now: '2026-11-16T12:00:00-08:00' };

test.describe('due dates never shift with the time zone', () => {
  test('the same date shows as 2026-11-20 in UTC-8 and UTC+10 (AC-9)', async ({ browser }) => {
    const la = await personWith(browser, 'tzla', [{ title: 'Pay rent' }], {
      timezoneId: 'America/Los_Angeles',
    });
    const bne = await personWith(browser, 'tzbne', [{ title: 'Pay rent' }], {
      timezoneId: 'Australia/Brisbane',
    });
    for (const { page } of [la, bne]) {
      await setRowDate(page, 'Pay rent', '2026-11-20');
      await expect(rowFor(page, 'Pay rent')).toContainText('Due Nov 20, 2026');
      await page.reload();
      await expect(page.getByLabel('Due date for Pay rent')).toHaveValue('2026-11-20');
      await expect(rowFor(page, 'Pay rent')).toContainText('Due Nov 20, 2026');
    }
    await la.context.close();
    await bne.context.close();
  });

  test('a date added through the form reads back unchanged in both zones (AC-2 AC-9)', async ({
    browser,
  }) => {
    for (const timezoneId of ['America/Los_Angeles', 'Australia/Brisbane']) {
      const { context, page } = await personWith(browser, 'tzadd', [], { timezoneId });
      await page.getByLabel('New task').fill('Book flights');
      await page.getByLabel('Due date', { exact: true }).fill('2026-11-20');
      await page
        .getByRole('combobox', { name: 'Priority', exact: true })
        .first()
        .selectOption('high');
      await page.getByRole('button', { name: 'Add' }).click();
      await expect(rowFor(page, 'Book flights')).toContainText('Due Nov 20, 2026');
      await expect(rowFor(page, 'Book flights')).toContainText('High priority');
      await page.reload();
      await expect(rowFor(page, 'Book flights')).toContainText('Due Nov 20, 2026');
      await context.close();
    }
  });
});

test.describe("overdue, today and this week follow the user's own calendar", () => {
  test('rows say Overdue and Due today; a completed row never says Overdue (AC-10)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'words', CALENDAR_SEED, LA);
    await expect(rowFor(page, 'Past due')).toContainText('Overdue');
    await expect(rowFor(page, 'Due now')).toContainText('Due today');
    await expect(rowFor(page, 'Done late')).toHaveCount(1);
    await expect(rowFor(page, 'Done late')).not.toContainText('Overdue');
    await expect(rows(page).getByText('Overdue', { exact: true })).toHaveCount(1);
    await context.close();
  });

  test('Overdue, Today and This week include the boundary days and nothing past them (AC-5)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'bounds', CALENDAR_SEED, LA);
    await select(page, 'Due').selectOption('overdue');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Past due');

    await select(page, 'Due').selectOption('today');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Due now');

    await select(page, 'Due').selectOption('week');
    await expect(rows(page)).toHaveCount(2);
    await expect(rowFor(page, 'Due now')).toHaveCount(1);
    await expect(rowFor(page, 'Week end')).toHaveCount(1);
    await expect(rowFor(page, 'Next week')).toHaveCount(0);

    await select(page, 'Due').selectOption('none');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('No date');
    await context.close();
  });
});

test.describe('the date line and sorting', () => {
  test('the same data reads differently on the other side of the date line (AC-9 AC-5)', async ({
    browser,
  }) => {
    // 16 Nov 12:00 in LA is already 17 Nov 07:00 in Brisbane: "Due now" is overdue there.
    const bne = await personWith(browser, 'bnedue', CALENDAR_SEED, {
      timezoneId: 'Australia/Brisbane',
      now: '2026-11-17T07:00:00+10:00',
    });
    await expect(rowFor(bne.page, 'Due now')).toContainText('Overdue');
    await bne.context.close();
  });

  test('sorting by due date puts no-date last, and by priority High, Medium, Low (AC-6)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'sorts', CALENDAR_SEED, LA);
    await select(page, 'Sort').selectOption('due');
    await expect(rows(page).first()).toContainText('Done late');
    await expect(rows(page).last()).toContainText('No date');
    await select(page, 'Sort').selectOption('priority');
    await expect(rows(page).first()).toContainText('Past due');
    await expect(rows(page).last()).toContainText('Week end');
    await context.close();
  });
});

test.describe('filters, Clear filters and memory', () => {
  const seed: SeedTask[] = [
    { title: 'Pay rent', dueDate: '2026-11-10', priority: 'high' },
    { title: 'Buy milk', dueDate: '2026-12-30', priority: 'low' },
    { title: 'Walk dog', completed: true },
  ];

  test('filters change the list, Clear filters keeps the search text, and no match is explained (AC-11)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'filt', seed, LA);
    await expect(rows(page)).toHaveCount(3);
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill('o');
    await select(page, 'Status').selectOption('completed');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Walk dog');

    await select(page, 'Priority').selectOption('high');
    await expect(page.getByText(NO_FILTER_MATCH).first()).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('o');
    await expect(select(page, 'Status')).toHaveValue('all');
    // The kept search 'o' still narrows the list, so only 'Walk dog' is left.
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Walk dog');
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    await context.close();
  });

  test('filters and sort survive a reload; the search text does not (AC-12)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'mem', seed, LA);
    await select(page, 'Sort').selectOption('due');
    await select(page, 'Status').selectOption('pending');
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill('rent');
    await expect(rows(page)).toHaveCount(1);
    await page.reload();
    await expect(select(page, 'Sort')).toHaveValue('due');
    await expect(select(page, 'Status')).toHaveValue('pending');
    await expect(page.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('');
    await expect(rows(page)).toHaveCount(2);
    await context.close();
  });
});

test.describe('filter privacy', () => {
  const seed: SeedTask[] = [
    { title: 'Pay rent', dueDate: '2026-11-10', priority: 'high' },
    { title: 'Walk dog', completed: true },
  ];

  test('another user in the same browser context starts from the defaults (AC-12 AC-7)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'memA', seed, LA);
    await select(page, 'Sort').selectOption('priority');
    const keysOf = async () =>
      JSON.parse(
        (await page.evaluate(
          "JSON.stringify(Object.keys(window.localStorage).filter((k) => k.startsWith('tasknest-filters:')))",
        )) as string,
      ) as string[];
    const firstKeys = await keysOf();
    expect(firstKeys).toHaveLength(1);

    // Sign the first user out and a second one in, in the very same browser context.
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
    const registered = await page.request.post('/api/auth/register', {
      data: { username: uniqueName('memB'), password: PASSWORD },
    });
    expect(registered.ok()).toBe(true);
    await page.goto('/');
    await expect(select(page, 'Sort')).toHaveValue('newest');
    await expect(select(page, 'Status')).toHaveValue('all');
    // The first user's remembered choice is still stored, under their own key only.
    expect(await keysOf()).toEqual(firstKeys);
    await context.close();
  });

  test("never shows one user another user's tasks under any filter (AC-7)", async ({ browser }) => {
    const alice = await personWith(
      browser,
      'alice',
      [{ title: 'Secret plan', priority: 'high' }],
      LA,
    );
    const bob = await personWith(browser, 'bob', [{ title: 'Buy bread' }], LA);
    await select(bob.page, 'Priority').selectOption('high');
    await expect(bob.page.getByText(NO_FILTER_MATCH).first()).toBeVisible();
    await expect(bob.page.getByText('Secret plan')).toHaveCount(0);
    await select(alice.page, 'Priority').selectOption('high');
    await expect(rows(alice.page)).toHaveCount(1);
    await alice.context.close();
    await bob.context.close();
  });
});

test.describe('overdue summary', () => {
  const seed: SeedTask[] = [
    { title: 'Late one', dueDate: '2026-11-01' },
    { title: 'Late two', dueDate: '2026-11-10', priority: 'high' },
    { title: 'Fine', dueDate: '2026-12-30' },
  ];

  test('shows the count, applies the Overdue filter, and follows edits (AC-13 AC-14)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'sum', seed, LA);
    const summary = page.getByRole('button', { name: '2 overdue' });
    await expect(summary).toBeVisible();
    await select(page, 'Priority').selectOption('low');
    await expect(summary).toBeVisible(); // ignores filters (DEC-212)
    await select(page, 'Priority').selectOption('all');

    await summary.click();
    await expect(select(page, 'Due')).toHaveValue('overdue');
    await expect(rows(page)).toHaveCount(2);

    await setRowDate(page, 'Late one', '2026-12-25');
    await expect(page.getByRole('button', { name: '1 overdue' })).toBeVisible();
    await expect(rows(page)).toHaveCount(2); // no client-side re-filtering (DEC-207)

    await page.getByRole('checkbox', { name: 'Mark Late two as completed' }).check();
    await expect(page.getByRole('button', { name: /overdue$/ })).toHaveCount(0);
    await context.close();
  });

  test('editing a priority and clearing a date save and survive a reload (AC-3 AC-14)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'edit', seed, LA);
    await page.getByRole('combobox', { name: 'Priority for Fine' }).selectOption('high');
    await page.getByRole('button', { name: 'Clear date for Fine' }).click();
    await expect(page.getByLabel('Due date for Fine')).toHaveValue('');
    await page.reload();
    await expect(rowFor(page, 'Fine')).toContainText('High priority');
    await expect(page.getByLabel('Due date for Fine')).toHaveValue('');
    await context.close();
  });

  test('a refused date edit rolls back and shows the usual failure message (AC-14)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'fail', seed, LA);
    await page.route('**/api/tasks/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: '{"error":{"code":"INTERNAL","message":"Something went wrong."}}',
          })
        : route.continue(),
    );
    await setRowDate(page, 'Fine', '2027-01-01');
    await expect(page.getByText('Could not save your change. It was undone.')).toBeVisible();
    await expect(page.getByLabel('Due date for Fine')).toHaveValue('2026-12-30');
    await context.close();
  });
});

test.describe('layout and keyboard', () => {
  const seed: SeedTask[] = [
    { title: 'Pay rent', dueDate: '2026-11-10', priority: 'high' },
    { title: 'Buy milk', dueDate: '2026-12-30' },
  ];

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`fits a 360px screen with no sideways scroll in ${colorScheme} mode (AC-15)`, async ({
      browser,
    }) => {
      const { context, page } = await personWith(browser, `w360${colorScheme}`, seed, {
        ...LA,
        colorScheme,
        viewport: { width: 360, height: 740 },
      });
      await expect(rows(page)).toHaveCount(2);
      await expect(page.getByRole('button', { name: '1 overdue' })).toBeVisible();
      await select(page, 'Due').selectOption('overdue');
      await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
      const overflow = (await page.evaluate(
        'document.documentElement.scrollWidth > document.documentElement.clientWidth',
      )) as boolean;
      expect(overflow).toBe(false);
      // The theme really applied: the page's own tokens and scheme match the device's, so the two
      // runs of this test are drawn from different palettes.
      const background = (await page.evaluate(
        "getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()",
      )) as string;
      const scheme = (await page.evaluate(
        'getComputedStyle(document.documentElement).colorScheme',
      )) as string;
      expect(background).toBe(colorScheme === 'dark' ? '#0f0f17' : '#ffffff');
      expect(scheme).toBe(colorScheme);
      // Every control in the filter bar, the add form and a row is at least 44px tall and on screen.
      const controls: Locator[] = [
        ...['Status', 'Priority', 'Due', 'Sort'].map((name) => select(page, name)),
        page.getByLabel('New task'),
        page.getByLabel('Due date', { exact: true }),
        page.locator('#new-task-priority'),
        page.getByRole('button', { name: 'Add', exact: true }),
        page.getByLabel('Due date for Pay rent'),
        page.getByRole('button', { name: 'Clear date for Pay rent' }),
        page.getByRole('combobox', { name: 'Priority for Pay rent' }),
        page.getByRole('button', { name: 'Edit', exact: true }).first(),
      ];
      for (const control of controls) {
        const box = await control.boundingBox();
        // Layout height, not the painted box: rows play an enter animation after the filter
        // change, and a box measured mid-animation is scaled below its real 44px.
        const height = await control.evaluate(
          (el) => (el as unknown as { offsetHeight: number }).offsetHeight,
        );
        expect(height).toBeGreaterThanOrEqual(44);
        expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
      }
      await context.close();
    });
  }
});

test.describe('keyboard', () => {
  const seed: SeedTask[] = [
    { title: 'Pay rent', dueDate: '2026-11-10', priority: 'high' },
    { title: 'Buy milk', dueDate: '2026-12-30' },
  ];

  test('adding a task and editing its date and priority work with the keyboard alone (AC-15)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'kbd', seed, LA);
    // Add form: title, then Tab to the date, Tab to the priority, Tab to Add, Enter.
    await page.getByLabel('New task').click();
    await page.keyboard.type('Book flights');
    await tabTo(page, page.getByLabel('Due date', { exact: true }));
    await page.keyboard.type(await dateKeys(context, 2026, 11, 20));
    const addPriority = page.locator('#new-task-priority');
    await tabTo(page, addPriority);
    await page.keyboard.press('ArrowDown'); // Medium to High
    await expect(addPriority).toHaveValue('high');
    await tabTo(page, page.getByRole('button', { name: 'Add' }));
    await page.keyboard.press('Enter');
    await expect(rowFor(page, 'Book flights')).toContainText('Nov 20, 2026');
    await expect(rowFor(page, 'Book flights')).toContainText('High priority');

    // Edit that row by keyboard: type a new date and press Enter (saves), then change the priority.
    const rowDate = page.getByLabel('Due date for Book flights');
    await tabTo(page, rowDate, 40);
    await page.keyboard.type(await dateKeys(context, 2026, 12, 25));
    // Tab only steps between the date's parts here; Enter is the keyboard way to save it.
    await page.keyboard.press('Enter');
    await expect(rowFor(page, 'Book flights')).toContainText('Dec 25, 2026');
    const rowPriority = page.getByRole('combobox', { name: 'Priority for Book flights' });
    await tabTo(page, rowPriority);
    await page.keyboard.press('ArrowUp'); // High to Medium
    await page.keyboard.press('ArrowUp'); // Medium to Low
    await expect(rowPriority).toHaveValue('low');
    await expect(rowFor(page, 'Book flights')).toContainText('Low priority');
    await page.reload();
    await expect(rowFor(page, 'Book flights')).toContainText('Dec 25, 2026');
    await expect(rowFor(page, 'Book flights')).toContainText('Low priority');

    await context.close();
  });

  test('the filter bar and the overdue summary work with the keyboard alone (AC-15)', async ({
    browser,
  }) => {
    const { context, page } = await personWith(browser, 'kbdf', seed, LA);
    // Filter bar: Tab to the Due select, choose Overdue, then clear it with Enter.
    const due = select(page, 'Due');
    await page.getByLabel('New task').click();
    await tabTo(page, due, 40);
    await page.keyboard.type('Overdue');
    await expect(due).toHaveValue('overdue');
    await expect(rows(page)).toHaveCount(1);
    await tabTo(page, page.getByRole('button', { name: 'Clear filters' }).first(), 40);
    await page.keyboard.press('Enter');
    await expect(due).toHaveValue('any');

    // Overdue summary is a real button and Enter activates it.
    await tabTo(page, page.getByRole('button', { name: '1 overdue' }), 40);
    await page.keyboard.press('Enter');
    await expect(due).toHaveValue('overdue');
    await context.close();
  });
});
