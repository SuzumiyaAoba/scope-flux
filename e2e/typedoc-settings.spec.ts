import { expect, test } from '@playwright/test';

test.describe('typedoc settings persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/typedoc/modules/core_src.html');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
  });

  test('settings changes are reflected in localStorage', async ({ page }) => {
    const inherited = page.locator('#tsd-filter-inherited');
    const external = page.locator('#tsd-filter-external');
    const theme = page.locator('#tsd-theme');

    await expect(inherited).toBeAttached();
    await expect(external).toBeAttached();
    await expect(theme).toBeAttached();

    await page.evaluate(() => {
      const input = document.getElementById('tsd-filter-inherited') as HTMLInputElement | null;
      if (!input) {
        throw new Error('tsd-filter-inherited not found');
      }
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.localStorage.getItem('filter-inherited'));
      })
      .toBe('false');

    await page.evaluate(() => {
      const input = document.getElementById('tsd-filter-inherited') as HTMLInputElement | null;
      if (!input) {
        throw new Error('tsd-filter-inherited not found');
      }
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.localStorage.getItem('filter-inherited'));
      })
      .toBe('true');

    await page.evaluate(() => {
      const input = document.getElementById('tsd-filter-external') as HTMLInputElement | null;
      if (!input) {
        throw new Error('tsd-filter-external not found');
      }
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.localStorage.getItem('filter-external'));
      })
      .toBe('true');

    await page.evaluate(() => {
      const select = document.getElementById('tsd-theme') as HTMLSelectElement | null;
      if (!select) {
        throw new Error('tsd-theme not found');
      }
      select.value = 'dark';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.localStorage.getItem('tsd-theme'));
      })
      .toBe('dark');

    await page.evaluate(() => {
      const select = document.getElementById('tsd-theme') as HTMLSelectElement | null;
      if (!select) {
        throw new Error('tsd-theme not found');
      }
      select.value = 'light';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.localStorage.getItem('tsd-theme'));
      })
      .toBe('light');
  });
});
