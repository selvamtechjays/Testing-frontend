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

/** A tiny stateful stand-in for the session endpoints: login sets it, logout clears it. */
async function stubSessionApi(page: Page, options: { signedIn: boolean }) {
  let signedIn = options.signedIn;
  await page.route('**/api/auth/me', (route) =>
    route.fulfill(
      signedIn
        ? json(200, { user: USER })
        : json(401, { error: { code: 'UNAUTHENTICATED', message: 'Not signed in.' } }),
    ),
  );
  await page.route('**/api/auth/login', (route) => {
    const body = route.request().postDataJSON() as { password: string };
    if (body.password === 'hunter2hunter2') {
      signedIn = true;
      return route.fulfill(json(200, { user: USER }));
    }
    return route.fulfill(
      json(401, {
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password.' },
      }),
    );
  });
  await page.route('**/api/auth/logout', (route) => {
    signedIn = false;
    return route.fulfill(json(204));
  });
}

async function signInAs(page: Page, password: string) {
  await page.getByLabel('Username').fill('Selvam');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('sign in and sign out', () => {
  test('signs in, lands on the task list, logs out and Back does not reveal it (AC-1 AC-5 AC-9 TS-1 TS-5 TS-11)', async ({
    page,
  }) => {
    await stubSessionApi(page, { signedIn: false });
    await page.goto('/signin');
    await signInAs(page, 'hunter2hunter2');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'TaskNest' })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();

    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'TaskNest' })).toHaveCount(0);

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'TaskNest' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  });

  test('opening the task list address while signed out shows sign-in (AC-9 TS-12)', async ({
    page,
  }) => {
    await stubSessionApi(page, { signedIn: false });
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'TaskNest' })).toHaveCount(0);
  });

  test('shows one generic error for a wrong password and keeps the form usable (AC-6 AC-8 BR-2 TS-6)', async ({
    page,
  }) => {
    await stubSessionApi(page, { signedIn: false });
    await page.goto('/signin');
    await signInAs(page, 'not the password');
    await expect(page.getByRole('alert')).toHaveText('Incorrect username or password.');
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByLabel('Password')).toBeFocused();
    await signInAs(page, 'hunter2hunter2');
    await expect(page).toHaveURL(/\/$/);
  });

  test('offers no Remember me or Forgot password (AC-11 TS-10)', async ({ page }) => {
    await stubSessionApi(page, { signedIn: false });
    await page.goto('/signin');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByText(/remember|forgot/i)).toHaveCount(0);
  });

  test('a signed-in user opening /signin is sent to the task list (DEC-066)', async ({ page }) => {
    await stubSessionApi(page, { signedIn: true });
    await page.goto('/signin');
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('sign-in layout', () => {
  for (const [name, size] of [
    ['phone', { width: 375, height: 667 }],
    ['desktop', { width: 1280, height: 800 }],
  ] as const) {
    test(`sign-in form fits the viewport at ${name} width`, async ({ page }) => {
      await stubSessionApi(page, { signedIn: false });
      await page.setViewportSize(size);
      await page.goto('/signin');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
      const overflow = await page.evaluate<number>(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
