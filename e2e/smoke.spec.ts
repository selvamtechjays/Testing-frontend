import { test, expect } from './fixtures';

// Harness smoke: proves the built app serves and renders. Not a feature test.
test('app loads and shows the title', async ({ appPage }) => {
  await appPage.goto();
  await expect(appPage.heading).toHaveText('Testing-Delivery-os');
});
