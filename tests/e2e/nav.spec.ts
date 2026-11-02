import { expect, test } from '@playwright/test';
import { NAV, SITE } from '../../src/lib/site';
import { tabThroughPage } from './utils/keyboard';

const label = (text: string) => new RegExp(`^${text}$`, 'i');

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('nav reaches every section and marks the current page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: label('menu') })).toBeHidden();
    for (const item of NAV) {
      const nav = page.getByRole('navigation', { name: 'Main' });
      await nav.getByRole('link', { name: label(item.label) }).click();
      await expect(page).toHaveURL(item.href);
      await expect(nav.locator('[aria-current]')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: label(item.label) })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('Tab reaches every link and button', async ({ page }) => {
    await page.goto('/');
    const { expected, missed } = await tabThroughPage(page);
    expect(expected.length).toBeGreaterThanOrEqual(NAV.length + 4); // skip link, wordmark, nav, footer
    expect(missed).toEqual([]);
  });

  test('skip link is first and moves focus to main', async ({ page }) => {
    await page.goto('/publications/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('footer links come from "My details"', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', SITE.githubUrl);
    await expect(footer.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute('href', SITE.linkedinUrl);
    await expect(footer.getByRole('link', { name: /Email/ })).toHaveAttribute('href', `mailto:${SITE.email}`);
  });
});

test.describe('mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('menu opens and closes with the mouse and Escape', async ({ page }) => {
    await page.goto('/projects/');
    const toggle = page.getByRole('button', { name: label('menu') });
    const list = page.locator('#nav-links');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(list).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await page.getByRole('link', { name: label('blog') }).click();
    await expect(page).toHaveURL('/blog/');
    await expect(page.locator('#nav-links')).toBeHidden();
  });

  test('menu works with the keyboard alone', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: label('menu') });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const item of NAV) {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: label(item.label) })).toBeFocused();
    }
    // Tabbing past the last link closes the menu.
    await page.keyboard.press('Tab');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/projects/');
  });

  test('Tab reaches every link with the menu open', async ({ page }) => {
    await page.goto('/resume/');
    await page.getByRole('button', { name: label('menu') }).click();
    await page.locator('body').focus();
    const { missed } = await tabThroughPage(page);
    expect(missed).toEqual([]);
  });
});

test.describe('without JavaScript (375px)', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });

  test('nav links are shown and the menu button is not', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: label('menu') })).toBeHidden();
    for (const item of NAV) {
      await expect(page.getByRole('link', { name: label(item.label) })).toBeVisible();
    }
  });
});
