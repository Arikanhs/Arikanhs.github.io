import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fuzzyScore } from '../../src/lib/fuzzy';

// Stage 11: command palette and scroll reveal (production build).
const projectsDir = path.resolve(import.meta.dirname, '../../src/content/projects');
const projects = fs
  .readdirSync(projectsDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({
    slug: f.replace(/\.md$/, ''),
    title: /^title:\s*(.+)$/m.exec(fs.readFileSync(path.join(projectsDir, f), 'utf8'))![1].replace(/^'|'$/g, ''),
  }));

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Command palette' });
const input = (page: Page) => page.getByRole('combobox', { name: /Search pages/ });

test('Ctrl+K and Cmd+K open and close it; Esc closes and returns focus', async ({ page }) => {
  await page.goto('/projects/');
  await page.locator('body').click();
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await page.keyboard.press('Meta+k');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Meta+k');
  await expect(dialog(page)).toBeHidden();

  const button = page.getByRole('button', { name: /^search/ });
  await button.click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(button).toBeFocused();
});

test('every project is reachable with the keyboard alone', async ({ page }) => {
  await page.goto('/');
  for (const project of projects) {
    await page.keyboard.press('Control+k');
    await page.keyboard.type(project.title.split(' ').slice(0, 3).join(' '));
    // Walk the results with the arrow keys until the project is the active option.
    for (let i = 0; i < 12; i += 1) {
      const active = page.locator('[role="option"][aria-selected="true"]');
      if ((await active.textContent())?.includes(project.title)) break;
      await page.keyboard.press('ArrowDown');
    }
    await expect(page.locator('[role="option"][aria-selected="true"]')).toContainText(project.title);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/projects/${project.slug}/`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(project.title);
  }
});

test('arrow keys move the active option and focus stays inside while open', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const first = page.locator('[role="option"]').first();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(input(page)).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role="option"]').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp'); // wraps to the last option
  await expect(page.locator('[role="option"]').last()).toHaveAttribute('aria-selected', 'true');
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
});

test('fuzzy matching ranks close matches first and shows "No matches."', async ({ page }) => {
  expect(fuzzyScore('kok', 'Graph algorithms on Kokkos')).toBeGreaterThan(fuzzyScore('kok', 'work book'));
  expect(fuzzyScore('zzz', 'Image2ASCII')).toBe(0);
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('kok');
  await expect(page.locator('[role="option"]').first()).toContainText('Kokkos');
  await input(page).fill('qqqxx');
  await expect(page.getByText('No matches.')).toBeVisible();
});

test('section cards reveal as they scroll into view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/resume/');
  const last = page.locator('[data-reveal]').last();
  await expect(last).toHaveCSS('opacity', '0');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveClass(/is-revealed/);
  await expect(last).toHaveCSS('opacity', '1');
});

test('with reduced motion nothing is hidden for a reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/resume/');
  for (const el of await page.locator('[data-reveal]').all()) await expect(el).toHaveCSS('opacity', '1');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the search button is hidden and reveal targets are visible', async ({ page }) => {
    await page.goto('/projects/');
    await expect(page.getByRole('button', { name: /^search/ })).toBeHidden();
    await expect(page.locator('[data-reveal]').first()).toHaveCSS('opacity', '1');
  });
});

test('the open palette passes axe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('gr');
  const { violations } = await new AxeBuilder({ page })
    .include('#command-palette')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
