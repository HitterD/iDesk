import { test, expect } from '@playwright/test';

test.describe('Hardware Requests layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_ICT_EMAIL || 'ict@idesk.test');
    await page.getByLabel(/password/i).fill(process.env.E2E_ICT_PASSWORD || 'password');
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL('**/dashboard');
  });

  test('tabs navigate between List / Dashboard / Calendar', async ({ page }) => {
    await page.goto('/hardware-requests');
    await expect(page.getByRole('heading', { name: /hardware requests/i })).toBeVisible();
    const nav = page.getByRole('navigation', { name: /hardware requests tabs/i });

    await nav.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/hardware-requests\/dashboard$/);
    await expect(nav.getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: /kalender/i }).click();
    await expect(page).toHaveURL(/\/hardware-requests\/calendar$/);
    await expect(nav.getByRole('link', { name: /kalender/i })).toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: /permintaan/i }).click();
    await expect(page).toHaveURL(/\/hardware-requests$/);
  });

  test('expandable row reveals items in list', async ({ page }) => {
    await page.goto('/hardware-requests');
    const firstExpand = page.getByRole('button', { name: /lihat \d+ item/i }).first();
    await firstExpand.click();
    await expect(page.getByRole('button', { name: /sembunyikan/i })).toBeVisible();
  });

  test('sidebar no longer shows HR Calendar and HR Dashboard duplicates', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.getByRole('navigation', { name: /main|sidebar/i });
    await expect(sidebar.getByRole('link', { name: /^HR Calendar$/ })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /^HR Dashboard$/ })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /^Hardware Requests$/ })).toBeVisible();
  });
});
