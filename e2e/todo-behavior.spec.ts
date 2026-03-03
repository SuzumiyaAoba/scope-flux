import { expect, test } from '@playwright/test';

test.describe('todo tutorial behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tutorial-todo');
    await page.getByTestId('todo-reset').click();
  });

  test('can add, filter, toggle and delete a todo', async ({ page }) => {
    await page.getByTestId('todo-input').fill('Buy milk');
    await page.getByTestId('todo-add').click();

    await expect(page.getByText('Buy milk')).toBeVisible();
    await expect(page.getByTestId('todo-total')).toContainText('1');
    await expect(page.getByTestId('todo-active')).toContainText('1');

    await page.getByRole('checkbox').first().check();
    await page.getByTestId('todo-filter-done').click();
    await expect(page.getByText('Buy milk')).toBeVisible();
    await expect(page.getByTestId('todo-done')).toContainText('1');

    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByTestId('todo-empty')).toBeVisible();
    await expect(page.getByTestId('todo-total')).toContainText('0');
  });

  test('keeps state after reload', async ({ page }) => {
    await page.getByTestId('todo-input').fill('Persist me');
    await page.getByTestId('todo-add').click();
    await expect(page.getByText('Persist me')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Persist me')).toBeVisible();
  });
});
