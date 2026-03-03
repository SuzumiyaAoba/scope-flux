import { expect, test } from '@playwright/test';

test('docs home and api pages are reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/scope-flux/i);
  await expect(page.getByRole('link', { name: 'API' })).toBeVisible();

  await page.goto('/api/');
  await expect(page.getByRole('heading', { name: 'API Reference' })).toBeVisible();
});
