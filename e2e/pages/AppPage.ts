import type { Locator, Page } from '@playwright/test';

// Page-object skeleton. Add one class per page; keep selectors role/label based.
export class AppPage {
  readonly heading: Locator;
  readonly banner: Locator;
  readonly main: Locator;
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.banner = page.getByRole('banner');
    this.main = page.getByRole('main');
  }

  /** Opens the task list as a signed-in user: the session probe is stubbed (no backend in e2e). */
  async goto() {
    await this.page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: '665f1c0e9b1d8a3f4c2e7a10', username: 'selvam' } }),
      }),
    );
    // The home screen lists tasks; an empty list keeps this spec hermetic (no backend in e2e).
    await this.page.route('**/api/tasks', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"tasks":[]}' }),
    );
    await this.page.goto('/');
  }
}
