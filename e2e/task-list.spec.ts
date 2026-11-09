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

/** A tiny stateful stand-in for the session and task endpoints (newest first, like the server). */
async function stubTasksApi(page: Page, options: { failAdds?: boolean; tasks?: StubTask[] } = {}) {
  const tasks: StubTask[] = [...(options.tasks ?? [])];
  let counter = 0;
  await page.route('**/api/auth/me', (route) => route.fulfill(json(200, { user: USER })));
  await page.route('**/api/tasks', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill(json(200, { tasks }));
    if (options.failAdds) {
      return route.fulfill(json(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down.' } }));
    }
    counter += 1;
    const { title } = request.postDataJSON() as { title: string };
    const task: StubTask = {
      id: `task-${counter}`,
      title,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(task);
    return route.fulfill(json(201, { task }));
  });
}

test.describe('task list and add task', () => {
  test('signed in with no tasks, adds two and sees the newest at the top (AC-3 AC-4 AC-11 TS-2 TS-3 TS-17)', async ({
    page,
  }) => {
    await stubTasksApi(page);
    await page.goto('/');
    await expect(page.getByText('No tasks yet. Add your first task above.')).toBeVisible();

    const input = page.getByLabel('New task');
    await input.fill('Send brand colours to Techjays');
    await input.press('Enter');
    await expect(page.getByText('Send brand colours to Techjays')).toBeVisible();
    await expect(page.getByText('No tasks yet. Add your first task above.')).toHaveCount(0);

    await input.fill('Plan launch');
    await page.getByRole('button', { name: 'Add' }).click();
    const titles = page.getByRole('listitem');
    await expect(titles).toContainText(['Plan launch', 'Send brand colours to Techjays']);
    await expect(page.getByText('Pending')).toHaveCount(2);
  });

  test('shows existing tasks marked Pending or Completed (AC-1 AC-2 AC-9 TS-1 TS-14)', async ({
    page,
  }) => {
    const at = '2026-11-07T09:00:00.000Z';
    await stubTasksApi(page, {
      tasks: [
        { id: 'a', title: 'Plan launch', status: 'pending', createdAt: at },
        { id: 'b', title: 'Send logo', status: 'completed', createdAt: at },
      ],
    });
    await page.goto('/');
    await expect(page.getByRole('listitem')).toContainText(['Plan launch', 'Send logo']);
    await expect(page.getByText('Completed')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(1);
  });

  test('a failed save removes the new task and shows the message (AC-12 TS-13)', async ({
    page,
  }) => {
    await stubTasksApi(page, { failAdds: true });
    await page.goto('/');
    await page.getByLabel('New task').fill('Doomed task');
    await page.getByLabel('New task').press('Enter');
    await expect(page.getByRole('alert')).toHaveText(
      /Could not save your change\. It was undone\./,
    );
    await expect(page.getByText('Doomed task')).toHaveCount(0);
  });
});
