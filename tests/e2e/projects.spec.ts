import { expect, test } from '@playwright/test';

// Stage 5 layout checks against the production build.

test('every project card has an ASCII background and featured cards are larger', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/projects/');
  const cards = page.getByRole('list', { name: 'Projects' }).getByRole('article');
  const count = await cards.count();
  await expect(cards.locator('[data-ascii]')).toHaveCount(count);

  const featured = page.locator('article.card.is-featured');
  const regular = page.locator('article.card:not(.is-featured)');
  expect(await featured.count()).toBeGreaterThan(0);
  const featuredBox = await featured.first().boundingBox();
  if ((await regular.count()) > 0) {
    const regularBox = await regular.first().boundingBox();
    expect(featuredBox!.width * featuredBox!.height).toBeGreaterThan(regularBox!.width * regularBox!.height);
  }
});

test('the ASCII canvases are hidden from assistive technology', async ({ page }) => {
  await page.goto('/projects/');
  for (const root of await page.locator('[data-ascii]').all()) {
    await expect(root).toHaveAttribute('aria-hidden', 'true');
  }
});

test('home shows the featured projects under "Selected work"', async ({ page }) => {
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Selected work' });
  await expect(section).toBeVisible();
  const cards = section.getByRole('article');
  expect(await cards.count()).toBe(await page.locator('article.card.is-featured').count());
  await expect(section.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await expect(section.getByRole('link', { name: /All projects/ })).toHaveAttribute('href', '/projects/');
});
