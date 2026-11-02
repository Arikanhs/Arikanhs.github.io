import { expect, test } from '@playwright/test';

// Stage 6 project pages and client-side navigation, against the production build.

test('a project page shows title, tags, repo button and related publications', async ({ page }) => {
  await page.goto('/projects/gcn-cuda-tuning/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/GCN-driven CUDA tuning/);
  await expect(page.locator('header.hero').getByRole('list', { name: 'Tags' })).toBeVisible();
  await expect(page.getByRole('link', { name: /View code on GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/Arikanhs/ml_cuda',
  );
  const related = page.getByRole('complementary', { name: 'Related publications' });
  await expect(related.getByRole('link')).toHaveText(/GCN-Driven CUDA Parameter Optimization/);
  await expect(page.locator('.prose h2').first()).toBeVisible();
});

test('a project page without related publications has no related box', async ({ page }) => {
  await page.goto('/projects/image2ascii/');
  await expect(page.getByRole('complementary', { name: 'Related publications' })).toHaveCount(0);
});

test('every card links to its project page', async ({ page }) => {
  await page.goto('/projects/');
  for (const link of await page.locator('article.card a.stretched').all()) {
    await expect(link).toHaveAttribute('href', /^\/projects\/[\w-]+\/$/);
  }
});

test('after client-side navigation the mobile menu still works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await page.getByRole('button', { name: /^menu$/i }).click();
  await page.getByRole('link', { name: /^projects$/i }).click();
  await expect(page).toHaveURL('/projects/');
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  await expect(page.locator('html')).toHaveClass(/\bjs\b/);
  const toggle = page.getByRole('button', { name: /^menu$/i });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#nav-links [aria-current="page"]')).toHaveText(/projects/i);
});
