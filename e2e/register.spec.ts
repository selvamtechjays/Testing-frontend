// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app); backend stubbed with page.route
import { test, expect } from './fixtures';

test.describe('account registration', () => {
  test('registers and lands on the home screen (AC-1 AC-2 BR-6 TS-1 TS-2)', async ({ page }) => {
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: '665f0c2e9b1d4a0012ab34cd', username: 'priya_b' } }),
      }),
    );
    await page.goto('/register');
    await expect(page.locator('input')).toHaveCount(2);
    await page.getByLabel('Username').fill('Priya_B');
    await page.getByLabel('Password').fill('a 12 char pass');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'TaskNest' })).toBeVisible();
  });

  test('shows the taken-username message and keeps the form (AC-10 AC-11 TS-15 TS-16)', async ({
    page,
  }) => {
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'USERNAME_TAKEN',
            message: 'That username is already taken. Choose another.',
            fields: { username: 'That username is already taken. Choose another.' },
          },
        }),
      }),
    );
    await page.goto('/register');
    await page.getByLabel('Username').fill('priya_b');
    await page.getByLabel('Password').fill('a 12 char pass');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('That username is already taken. Choose another.')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe('registration layout and wording', () => {
  for (const [name, size] of [
    ['phone', { width: 375, height: 667 }],
    ['desktop', { width: 1280, height: 800 }],
  ] as const) {
    test(`register form fits the viewport at ${name} width (AC-2)`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/register');
      await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
      const overflow = await page.evaluate<number>(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('shows no email, verification, terms, privacy or Google wording (AC-14 TS-19)', async ({
    page,
  }) => {
    await page.goto('/register');
    await expect(page.getByText(/e-?mail|verif|terms|privacy|google/i)).toHaveCount(0);
  });
});
