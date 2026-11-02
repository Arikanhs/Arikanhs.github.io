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

async function settled(page: Page) {
  const roots = page.locator('[data-ascii]');
  await expect(roots.first()).toHaveAttribute('data-ascii-state', /static|live/, { timeout: 15_000 });
}

test('a card morphs into its project page and Back morphs it back', async ({ page }) => {
  await instrument(page);
  await openWithAscii(page, '/projects/');
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 42));
  const card = page.locator('article.card').first();
  const name = await card.evaluate((el) => getComputedStyle(el).viewTransitionName);
  expect(name).toMatch(/^project-/);
  const slug = name.replace('project-', '');

  await card.locator('a.stretched').click();
  await expect(page).toHaveURL(`/projects/${slug}/`);
  const header = page.locator('header.hero');
  await expect(header).toBeVisible();
  expect(await header.evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe(name);
  // Client-side navigation (no reload) through a view transition that captured the card.
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
  expect((await transitions(page)).at(-1)).toContain(name);

  await page.goBack();
  await expect(page).toHaveURL('/projects/');
  await expect(page.locator('article.card').first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
  expect((await transitions(page)).at(-1)).toContain(name);
});

test('ASCII still renders after several navigations, within the context budget', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = collectProblems(page);
  await openWithAscii(page, '/projects/');
  const slugs = await page
    .locator('article.card a.stretched')
    .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).pathname));
  for (let round = 0; round < 3; round += 1) {
    for (const path of slugs) {
      await page.locator(`a.stretched[href="${path}"]`).click();
      await expect(page).toHaveURL(path);
      await settled(page);
      await expect(page.locator('header.hero [data-ascii]')).toHaveAttribute('data-ascii-state', 'live', {
        timeout: 15_000,
      });
      await page.goBack();
      await expect(page).toHaveURL('/projects/');
      await settled(page);
    }
  }
  // Old pages' contexts are released: only this page's on-screen roots are live.
  expect(await page.locator('canvas.ascii-live').count()).toBeLessThanOrEqual(6);
  await expect(page.locator('[data-ascii-state="live"]').first()).toBeAttached({ timeout: 15_000 });
  expect(problems).toEqual([]);
});

test('navigation works without animation under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithAscii(page, '/projects/');
  await page.locator('article.card a.stretched').first().click();
  await expect(page.locator('header.hero')).toBeVisible();
  await expect(page.locator('header.hero [data-ascii]')).toHaveAttribute('data-ascii-state', 'static', {
    timeout: 15_000,
  });
});
