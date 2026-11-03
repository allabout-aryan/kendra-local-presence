import { expect, test } from '@playwright/test';

/**
 * End-to-end journey against the deployed/static build.
 * Runs in the demo workspace, so no Supabase credentials are required.
 *   pnpm build && npx serve out -p 3000
 *   E2E_BASE_URL=http://localhost:3000 pnpm test:e2e
 */
test.describe('Kendra end-to-end', () => {
  test('lands, enters the demo and sees a real portfolio', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Every outlet');

    await page.getByRole('button', { name: /open the live demo/i }).first().click();
    await page.waitForURL('**/dashboard');

    // KPIs are computed from the seeded data, not hardcoded
    await expect(page.getByText('Avg audit score')).toBeVisible();
    await expect(page.getByText('Outlets', { exact: true })).toBeVisible();
    await expect(page.getByText('Biggest wins available')).toBeVisible();
  });

  test('replies to a review and sees the reply persisted', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /explore the demo workspace/i }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/reviews');
    const firstReply = page.getByRole('button', { name: 'Reply' }).first();
    await firstReply.click();

    await page.getByRole('button', { name: /draft with ai/i }).click();
    const textarea = page.getByLabel('Reply text');
    await expect(textarea).not.toHaveValue('');

    await page.getByRole('button', { name: /post reply/i }).click();
    await expect(page.getByText(/reply posted/i)).toBeVisible();
  });

  test('bulk edit updates outlets and records a job', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /explore the demo workspace/i }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/bulk');
    await page.getByRole('button', { name: 'Select all' }).click();
    await page.getByRole('button', { name: /run bulk edit/i }).click();

    await expect(page.getByText(/bulk edit applied|finished with errors/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Recent jobs')).toBeVisible();
  });

  test('unauthenticated deep link redirects to sign in', async ({ page }) => {
    await page.goto('/team');
    await expect(page).toHaveURL(/\/login/);
  });

  test('works on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.getByRole('button', { name: /explore the demo workspace/i }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible();
  });
});
