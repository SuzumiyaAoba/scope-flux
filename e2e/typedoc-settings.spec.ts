import { expect, test } from '@playwright/test';

test.describe('typedoc settings persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/typedoc/modules/core_src.html');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();
  });

  test('all settings items are reflected in localStorage', async ({ page }) => {
    await expect(page.locator('#tsd-theme')).toBeAttached();
    await expect(page.locator('#tsd-filter-options input[type="checkbox"]')).toHaveCount(2);

    const filterNames = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#tsd-filter-options input[type="checkbox"]'))
        .map((el) => (el as HTMLInputElement).name)
        .filter((name) => name.length > 0);
    });

    for (const filterName of filterNames) {
      await page.evaluate((name) => {
        const selector = `#tsd-filter-options input[name="${name}"]`;
        const input = document.querySelector(selector) as HTMLInputElement | null;
        if (!input) {
          throw new Error(`filter input not found: ${name}`);
        }
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, filterName);
      await expect
        .poll(async () => {
          return await page.evaluate((name) => window.localStorage.getItem(`filter-${name}`), filterName);
        })
        .toBe('false');

      await page.evaluate((name) => {
        const selector = `#tsd-filter-options input[name="${name}"]`;
        const input = document.querySelector(selector) as HTMLInputElement | null;
        if (!input) {
          throw new Error(`filter input not found: ${name}`);
        }
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, filterName);
      await expect
        .poll(async () => {
          return await page.evaluate((name) => window.localStorage.getItem(`filter-${name}`), filterName);
        })
        .toBe('true');
    }

    for (const value of ['os', 'dark', 'light']) {
      await page.evaluate((nextTheme) => {
        const select = document.getElementById('tsd-theme') as HTMLSelectElement | null;
        if (!select) {
          throw new Error('tsd-theme not found');
        }
        select.value = nextTheme;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
      await expect
        .poll(async () => {
          return await page.evaluate(() => window.localStorage.getItem('tsd-theme'));
        })
        .toBe(value);
    }

    const accordionKeys = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.page-menu details.tsd-accordion > summary[data-key]'))
        .map((summary) => {
          return (summary as HTMLElement).dataset.key;
        })
        .filter((key): key is string => typeof key === 'string' && key.length > 0);
    });

    for (const key of accordionKeys) {
      await page.evaluate((summaryKey) => {
        const summary = document.querySelector(
          `.page-menu details.tsd-accordion > summary[data-key="${summaryKey}"]`
        ) as HTMLElement | null;
        const details = summary?.parentElement as HTMLDetailsElement | null;
        if (!summary || !details) {
          throw new Error(`accordion not found: ${summaryKey}`);
        }
        details.open = !details.open;
        details.dispatchEvent(new Event('toggle'));
      }, key);

      await expect
        .poll(async () => {
          return await page.evaluate((summaryKey) => {
            return window.localStorage.getItem(`tsd-accordion-${summaryKey}`);
          }, key);
        })
        .toMatch(/^(true|false)$/);
    }
  });
});
