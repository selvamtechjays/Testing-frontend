import type { Locator, Page } from '@playwright/test';

// Page-object skeleton. Add one class per page; keep selectors role/label based.
export class AppPage {
  readonly heading: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
  }

  async goto() {
    await this.page.goto('/');
  }
}
