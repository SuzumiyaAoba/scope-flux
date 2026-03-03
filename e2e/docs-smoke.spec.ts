import { expect, test } from '@playwright/test';

test('docs home and api pages are reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/scope-flux/i);
  await page.goto('/api/index.html');
  await expect(page).toHaveURL(/\/api\/index\.html/);
  await expect(page).toHaveTitle(/scope-flux/i);
});

test('api section links are navigable', async ({ page }) => {
  await page.goto('/api/serializer.html');
  await expect(page).toHaveURL(/\/api\/serializer\.html/);
  await expect(page).toHaveTitle(/Serializer/i);
});

test('core api page is reachable', async ({ page }) => {
  await page.goto('/api/core.html');
  await expect(page).toHaveURL(/\/api\/core\.html/);
  await expect(page).toHaveTitle(/Core/i);
});
