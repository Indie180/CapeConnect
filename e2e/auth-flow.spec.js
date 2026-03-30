const { test, expect } = require('@playwright/test');

test.describe('Root SPA passenger flow', () => {
  test('user can select an operator, log in, navigate to wallet, and log out', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('CapeConnect')).toBeVisible();
    await page.getByText('Select MyCiTi').click();

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    const passengerForm = page.locator('#passenger-form');
    await passengerForm.locator('input[type="email"]').fill('passenger@example.com');
    await passengerForm.locator('input[type="password"]').fill('password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Welcome back, passenger/i })).toBeVisible();

    await page.getByRole('link', { name: 'Wallet' }).click();
    await expect(page).toHaveURL(/\/wallet$/);
    await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Select Golden Arrow')).toBeVisible();
  });
});
