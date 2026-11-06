// tier: e2e
// requires: frontend-running (Playwright webServer builds and previews the app)
import { test, expect } from './fixtures';

const PHONE = { width: 375, height: 667 };
const DESKTOP = { width: 1280, height: 800 };

test.describe('platform baseline', () => {
  test('document language is English and no language switch exists (AC-4 AC-8 TS-4 TS-9)', async ({
    appPage,
    page,
  }) => {
    await appPage.goto();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByText(/language|idioma/i)).toHaveCount(0);
  });

  test('shows no logo, cookie banner, analytics prompt or legal text (AC-10 AC-11 TS-11 TS-12)', async ({
    appPage,
    page,
  }) => {
    await appPage.goto();
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(page.getByText(/cookie|analytics|privacy|terms/i)).toHaveCount(0);
  });

  for (const [name, size] of [
    ['phone', PHONE],
    ['desktop', DESKTOP],
  ] as const) {
    test(`layout stays usable at ${name} width without horizontal scroll (AC-3 TS-3)`, async ({
      appPage,
      page,
    }) => {
      await page.setViewportSize(size);
      await appPage.goto();
      await expect(appPage.heading).toBeVisible();
      const overflow = await page.evaluate<number>(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('baseline page has one banner and one main landmark (AC-5 AC-7 TS-5 TS-8)', async ({
    appPage,
  }) => {
    await appPage.goto();
    await expect(appPage.banner).toHaveCount(1);
    await expect(appPage.main).toHaveCount(1);
  });
});
