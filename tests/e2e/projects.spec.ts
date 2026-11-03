import { expect, test, type Page } from '@playwright/test';

// /projects: the list on the left, the viewer on the right (production build).
const rows = (page: Page) => page.locator('details[data-project]');
const shown = (page: Page) => page.locator('[data-shot]:not([hidden])');
const ids = (page: Page) => rows(page).evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.project ?? ''));

test('the first project starts open; opening another shows it and puts it in the URL', async ({ page }) => {
  await page.goto('/projects/');
  const [first, second] = await ids(page);
  expect(second).toBeTruthy();
  await expect(rows(page).first()).toHaveJSProperty('open', true);
  await expect(shown(page)).toHaveCount(1);
  await expect(shown(page)).toHaveAttribute('data-shot', first);
  await expect(page).toHaveURL('/projects/');

  await rows(page).nth(1).locator('summary').click();
  await expect(rows(page).nth(1)).toHaveJSProperty('open', true);
  await expect(rows(page).first()).toHaveJSProperty('open', false);
  await expect(shown(page)).toHaveAttribute('data-shot', second);
  await expect(page).toHaveURL(`/projects/#${second}`);

  // A refresh (or a shared link) reopens it.
  await page.reload();
  await expect(rows(page).nth(1)).toHaveJSProperty('open', true);
  await expect(shown(page)).toHaveAttribute('data-shot', second);
});

test('rows open and close with the keyboard', async ({ page }) => {
  await page.goto('/projects/');
  const second = rows(page).nth(1);
  await second.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(second).toHaveJSProperty('open', true);
  await expect(second.getByRole('link', { name: /Read more/ })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(second).toHaveJSProperty('open', false);
});

test('wide screens: list left, viewer right to the bottom of the screen; phones: viewer above', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/projects/');
  let list = (await page.getByRole('list', { name: 'Projects' }).boundingBox())!;
  let viewer = (await page.locator('.viewer').boundingBox())!;
  expect(viewer.x).toBeGreaterThanOrEqual(list.x + list.width);
  expect(Math.round(viewer.x + viewer.width)).toBe(1280);
  expect(Math.round(viewer.y + viewer.height)).toBe(800);

  await page.setViewportSize({ width: 375, height: 812 });
  list = (await page.getByRole('list', { name: 'Projects' }).boundingBox())!;
  viewer = (await page.locator('.viewer').boundingBox())!;
  expect(viewer.y + viewer.height).toBeLessThanOrEqual(list.y + 1);
  expect(viewer.width).toBe(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the first project is open with its image, and every row still opens', async ({ page }) => {
    await page.goto('/projects/');
    const [first] = await ids(page);
    await expect(rows(page).first()).toHaveJSProperty('open', true);
    await expect(shown(page)).toHaveAttribute('data-shot', first);
    await expect(shown(page).locator('img')).toBeVisible();
    await rows(page).nth(1).locator('summary').click();
    await expect(rows(page).nth(1).getByRole('link', { name: /Read more/ })).toBeVisible();
  });
});

test('the home page ASCII canvases are hidden from assistive technology', async ({ page }) => {
  await page.goto('/');
  const roots = page.locator('[data-ascii]');
  expect(await roots.count()).toBeGreaterThan(0);
  for (const root of await roots.all()) await expect(root).toHaveAttribute('aria-hidden', 'true');
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
