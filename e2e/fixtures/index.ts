import { test as base, expect } from '@playwright/test';
import { AppPage } from '../pages/AppPage';

// Extend with one fixture per page object; specs import { test, expect } from here.
export const test = base.extend<{ appPage: AppPage }>({
  appPage: async ({ page }, use) => {
    await use(new AppPage(page));
  },
});

export { expect };
