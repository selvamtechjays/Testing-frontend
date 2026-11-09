// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app); backend stubbed with page.route
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const USER = { id: '665f1c0e9b1d8a3f4c2e7a10', username: 'selvam' };
const json = (status: number, body?: unknown) => ({
  status,
  contentType: 'application/json',
  body: body === undefined ? '' : JSON.stringify(body),
});

interface StubTask {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  createdAt: string;
}

const at = '2026-11-07T09:00:00.000Z';
const seed = (): StubTask[] => [
  { id: 'n', title: 'Plan launch', status: 'pending', createdAt: at },
  { id: 'm', title: 'Pay hosting invoice', status: 'pending', createdAt: at },
  { id: 'o', title: 'Send logo', status: 'completed', createdAt: at },
];

/** A stateful stand-in: PATCH changes what a later GET returns, so a reload shows stored truth. */
async function stubTasksApi(page: Page, options: { failPatch?: boolean } = {}) {
  const tasks = seed();
  await page.route('**/api/auth/me', (route) => route.fulfill(json(200, { user: USER })));
  await page.route('**/api/tasks', (route) => route.fulfill(json(200, { tasks })));
  await page.route('**/api/tasks/*', (route) => {
    if (options.failPatch) {
      return route.fulfill(json(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down.' } }));
    }
    const id = route.request().url().split('/').pop();
    const patch = route.request().postDataJSON() as Partial<StubTask>;
    const task = tasks.find((t) => t.id === id);
    if (!task) return route.fulfill(json(404, { error: { code: 'NOT_FOUND', message: 'x' } }));
    Object.assign(task, patch);
    return route.fulfill(json(200, { task }));
  });
}

test.describe('edit and complete task', () => {
  test('ticks and unticks a task, in place, and the status survives a reload (AC-1 AC-2 AC-9 AC-10 TS-1 TS-2 TS-12 TS-14)', async ({
    page,
  }) => {
    await stubTasksApi(page);
    await page.goto('/');
    const titles = page.getByRole('listitem');
    await expect(titles).toContainText(['Plan launch', 'Pay hosting invoice', 'Send logo']);

    await page.getByRole('checkbox', { name: 'Mark Pay hosting invoice as completed' }).check();
    await expect(page.getByText('Completed')).toHaveCount(2);
    await expect(titles).toContainText(['Plan launch', 'Pay hosting invoice', 'Send logo']);

    await page.reload();
    await expect(page.getByText('Completed')).toHaveCount(2);
    await expect(
      page.getByRole('checkbox', { name: 'Mark Pay hosting invoice as not completed' }),
    ).toBeChecked();

    await page.getByRole('checkbox', { name: 'Mark Send logo as not completed' }).uncheck();
    await expect(page.getByText('Completed')).toHaveCount(1);
  });
});

test.describe('edit title and failed saves', () => {
  test('edits a title, keeps the row in place and the title survives a reload (AC-3 AC-9 TS-3 TS-13)', async ({
    page,
  }) => {
    await stubTasksApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Edit' }).nth(1).click();
    const input = page.getByRole('textbox', { name: 'Edit title' });
    await input.fill('Pay brightleaf hosting');
    await input.press('Enter');
    await expect(page.getByRole('listitem')).toContainText([
      'Plan launch',
      'Pay brightleaf hosting',
      'Send logo',
    ]);
    await page.reload();
    await expect(page.getByText('Pay brightleaf hosting')).toBeVisible();
  });

  test('an empty title is refused with a message and the old title is kept (AC-5 TS-7)', async ({
    page,
  }) => {
    await stubTasksApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const input = page.getByRole('textbox', { name: 'Edit title' });
    await input.fill('');
    await input.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Enter a title.');
    await input.press('Escape');
    await expect(page.getByText('Plan launch')).toBeVisible();
  });

  test('a failed save puts the status and the title back and shows the message (AC-7 AC-8 TS-9 TS-10)', async ({
    page,
  }) => {
    await stubTasksApi(page, { failPatch: true });
    await page.goto('/');
    // click, not check(): a failed save undoes the tick at once, and check() would then fail on
    // its own post-click state verification before the rollback assertions below get to run.
    await page.getByRole('checkbox', { name: 'Mark Plan launch as completed' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      /Could not save your change\. It was undone\./,
    );
    await expect(
      page.getByRole('checkbox', { name: 'Mark Plan launch as completed' }),
    ).not.toBeChecked();

    await page.getByRole('button', { name: 'Edit' }).first().click();
    const input = page.getByRole('textbox', { name: 'Edit title' });
    await input.fill('Lost edit');
    await input.press('Enter');
    await expect(page.getByText('Lost edit')).toHaveCount(0);
    await expect(page.getByText('Plan launch')).toBeVisible();
  });
});
