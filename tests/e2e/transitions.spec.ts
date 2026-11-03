import { expect, test, type Page } from '@playwright/test';
import { collectProblems, openWithAscii } from './utils/ascii';

// Stage 6, in the "chrome-gpu" project (installed Chrome, real GPU, `astro dev`).
test.describe.configure({ mode: 'default' });

/** Counts view transitions and marks the window, so a full reload is detectable. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { transitions: string[] };
    w.transitions = [];
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
      const names = [...document.querySelectorAll<HTMLElement>('*')]
        .map((el) => getComputedStyle(el).viewTransitionName)
        .filter((name) => name && name !== 'none');
      w.transitions.push(names.join(' '));
      return start(arg);
    }) as typeof document.startViewTransition;
  });
}

const transitions = (page: Page) => page.evaluate(() => (window as unknown as { transitions: string[] }).transitions);

const ROWS = 'details[data-project]';
const readMore = (page: Page) => page.locator(`${ROWS}[open]`).getByRole('link', { name: /Read more/ });

test('the shown project morphs into its project page and Back returns to it', async ({ page }) => {
  await instrument(page);
  await openWithAscii(page, '/projects/', ROWS);
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 42));
  const shot = page.locator('[data-shot]:not([hidden])');
  const name = await shot.evaluate((el) => getComputedStyle(el).viewTransitionName);
  expect(name).toMatch(/^project-/);
  const slug = name.replace('project-', '');

  await readMore(page).click();
  await expect(page).toHaveURL(`/projects/${slug}/`);
  const header = page.locator('header.hero');
  await expect(header).toBeVisible();
  expect(await header.evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe(name);
  // Client-side navigation (no reload) through a view transition that captured the image.
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
  expect((await transitions(page)).at(-1)).toContain(name);

  await page.goBack();
  await expect(page).toHaveURL(/\/projects\/(#[\w-]+)?$/);
  await expect(page.locator(`[data-shot="${slug}"]`)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
  expect((await transitions(page)).at(-1)).toContain(name);
});

test('project pages render live ASCII after many navigations, and Back reopens the project', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = collectProblems(page);
  await openWithAscii(page, '/projects/', ROWS);
  const ids = await page.locator(ROWS).evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.project ?? ''));
  for (let round = 0; round < 3; round += 1) {
    for (const id of ids) {
      const row = page.locator(`${ROWS}[data-project="${id}"]`);
      if (!(await row.evaluate((el) => (el as HTMLDetailsElement).open))) await row.locator('summary').click();
      await readMore(page).click();
      await expect(page).toHaveURL(`/projects/${id}/`);
      await expect(page.locator('header.hero [data-ascii]')).toHaveAttribute('data-ascii-state', 'live', {
        timeout: 15_000,
      });
      await page.goBack();
      await expect(page).toHaveURL(/\/projects\/(#[\w-]+)?$/);
      await expect(row).toHaveJSProperty('open', true);
    }
  }
  // The project pages' WebGL contexts were released; /projects itself has none.
  await expect(page.locator('canvas.ascii-live')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('navigation works without animation under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithAscii(page, '/projects/', ROWS);
  await readMore(page).click();
  await expect(page.locator('header.hero')).toBeVisible();
  await expect(page.locator('header.hero [data-ascii]')).toHaveAttribute('data-ascii-state', 'static', {
    timeout: 15_000,
  });
});
