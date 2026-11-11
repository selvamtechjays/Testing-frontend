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

const seed = (): StubTask[] => [
  { id: 'n', title: 'Plan launch', status: 'pending', createdAt: '2026-11-07T12:00:00.000Z' },
  { id: 'm', title: 'Old idea', status: 'pending', createdAt: '2026-11-07T10:00:00.000Z' },
  { id: 'o', title: 'Send logo', status: 'completed', createdAt: '2026-11-07T08:00:00.000Z' },
];

/** A stateful stand-in: DELETE removes the task, so a reload shows stored truth. */
async function stubTasksApi(page: Page, options: { failDelete?: boolean } = {}) {
  const tasks = seed();
  const deleted: string[] = [];
  await page.route('**/api/auth/me', (route) => route.fulfill(json(200, { user: USER })));
  await page.route('**/api/tasks', (route) => route.fulfill(json(200, { tasks })));
  await page.route('**/api/tasks/*', (route) => {
    const id = route.request().url().split('/').pop() as string;
    deleted.push(id);
    if (options.failDelete) {
      return route.fulfill(json(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down.' } }));
    }
    const index = tasks.findIndex((task) => task.id === id);
    if (index >= 0) tasks.splice(index, 1);
    return route.fulfill({ status: 204 });
  });
  return { deleted };
}

const titles = (page: Page) => page.getByRole('listitem');

test.describe('delete task with Undo', () => {
  test('deletes at once, Undo restores it in place, and nothing is sent (AC-1 AC-2 BR-2 TS-1 TS-2)', async ({
    page,
  }) => {
    const { deleted } = await stubTasksApi(page);
    await page.clock.install();
    await page.goto('/');
    await expect(titles(page)).toContainText(['Plan launch', 'Old idea', 'Send logo']);

    await page.getByRole('button', { name: 'Delete Old idea' }).click();
    await expect(titles(page)).toContainText(['Plan launch', 'Send logo']);
    await expect(page.getByRole('status')).toHaveText(/Task deleted - Undo/);

    await page.clock.fastForward(3000);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(titles(page)).toContainText(['Plan launch', 'Old idea', 'Send logo']);
    await page.clock.fastForward(10_000);
    expect(deleted).toEqual([]);
  });

  test('after 5 seconds Undo is gone, the task stays deleted and a reload agrees (AC-3 AC-5 AC-6 TS-3 TS-6 TS-8)', async ({
    page,
  }) => {
    const { deleted } = await stubTasksApi(page);
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Delete Old idea' }).click();
    await page.clock.fastForward(4900);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await page.clock.fastForward(200);
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
    await expect.poll(() => deleted).toEqual(['m']);

    await page.reload();
    await expect(titles(page)).toContainText(['Plan launch', 'Send logo']);
  });
});

test.describe('delete task: other cases', () => {
  test('a Completed task is deleted and undone the same way (AC-4 TS-4)', async ({ page }) => {
    await stubTasksApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Delete Send logo' }).click();
    await expect(titles(page)).toContainText(['Plan launch', 'Old idea']);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(titles(page)).toContainText(['Plan launch', 'Old idea', 'Send logo']);
    await expect(page.getByText('Completed')).toBeVisible();
  });

  test('closing the page inside the window makes the delete final (AC-7 TS-10)', async ({
    page,
  }) => {
    const { deleted } = await stubTasksApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Delete Old idea' }).click();
    await page.evaluate("window.dispatchEvent(new Event('pagehide'))");
    await expect.poll(() => deleted).toEqual(['m']);
    await page.reload();
    await expect(titles(page)).toContainText(['Plan launch', 'Send logo']);
  });

  test('a failed delete puts the task back in its place and shows the message (AC-8 TS-9)', async ({
    page,
  }) => {
    await stubTasksApi(page, { failDelete: true });
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Delete Old idea' }).click();
    await page.clock.fastForward(5100);
    await expect(page.getByRole('alert')).toHaveText(
      /Could not save your change\. It was undone\./,
    );
    await expect(titles(page)).toContainText(['Plan launch', 'Old idea', 'Send logo']);
  });
});
