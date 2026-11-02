import { expect, test, type Page } from '@playwright/test';
import { canvasChecksum, collectProblems, openWithAscii } from './utils/ascii';

// Stage 5, in the "chrome-gpu" project (installed Chrome, real GPU, `astro dev`).
// /lab/cards is a dev-only page with the sample projects repeated to 10 cards.
const MAX_LIVE = 6; // keep in sync with MAX_LIVE in src/components/ascii/runtime.ts

test.describe.configure({ mode: 'default' });

/** Live roots, and live roots that are not on screen. */
function liveReport(page: Page) {
  return page.evaluate(() => {
    const live = [...document.querySelectorAll<HTMLElement>('[data-ascii]')].filter((root) =>
      root.querySelector('canvas.ascii-live'),
    );
    const offScreen = live.filter((root) => {
      const r = root.getBoundingClientRect();
      return r.bottom < 0 || r.top > window.innerHeight;
    });
    return { live: live.length, offScreen: offScreen.length };
  });
}

test('ten cards: smooth scrolling, at most a handful of live contexts, clean console', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = collectProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openWithAscii(page, '/lab/cards');
  await expect(page.locator('article.card')).toHaveCount(10);
  await expect(page.locator('[data-ascii-state="live"]').first()).toBeAttached({ timeout: 15_000 });

  // Record frame times while scrolling down and back up with the mouse wheel.
  await page.evaluate(() => {
    const w = window as unknown as { frames: number[] };
    w.frames = [];
    let last = performance.now();
    const tick = (now: number) => {
      w.frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  let maxLive = 0;
  for (const direction of [1, -1]) {
    for (let step = 0; step < 14; step += 1) {
      await page.mouse.wheel(0, direction * 320);
      await page.waitForTimeout(120);
      maxLive = Math.max(maxLive, (await liveReport(page)).live);
    }
    // Once scrolling stops, only on-screen cards stay live.
    await page.waitForTimeout(1_200);
    const settled = await liveReport(page);
    expect(settled.offScreen).toBe(0);
    expect(settled.live).toBeGreaterThan(0);
  }
  expect(maxLive).toBeLessThanOrEqual(MAX_LIVE);

  const frames = await page.evaluate(() => (window as unknown as { frames: number[] }).frames.slice(1));
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  expect(frames.length).toBeGreaterThan(60);
  expect(p95, `95th percentile frame time (ms) over ${frames.length} frames`).toBeLessThan(50);
  expect(problems).toEqual([]);
});

test('hover resolves random glyphs into the image and ends on the resting frame', async ({ page }) => {
  await openWithAscii(page, '/projects/');
  const card = page.locator('article.card').first();
  const root = card.locator('[data-ascii]');
  await expect(root).toHaveAttribute('data-ascii-state', 'live', { timeout: 15_000 });
  const canvas = root.locator('canvas.ascii-live');
  const rest = await canvasChecksum(canvas);

  await card.hover();
  await expect(root).toHaveAttribute('data-ascii-effect', 'reveal');
  expect(await canvasChecksum(canvas)).not.toBe(rest); // scrambled mid-way
  await expect(root).not.toHaveAttribute('data-ascii-effect', /.+/, { timeout: 2_000 });
  expect(await canvasChecksum(canvas)).toBe(rest);

  await page.mouse.move(0, 0);
  await expect(root).toHaveAttribute('data-ascii-effect', 'dissolve');
  await expect(root).not.toHaveAttribute('data-ascii-effect', /.+/, { timeout: 2_000 });
  expect(await canvasChecksum(canvas)).toBe(rest);
});

test('keyboard focus inside a card plays the reveal', async ({ page }) => {
  await openWithAscii(page, '/projects/');
  const card = page.locator('article.card').first();
  const root = card.locator('[data-ascii]');
  await expect(root).toHaveAttribute('data-ascii-state', 'live', { timeout: 15_000 });
  await card.getByRole('link').first().focus();
  await expect(root).toHaveAttribute('data-ascii-effect', 'reveal');
});

test('with reduced motion, cards stay static and hover plays no effect', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithAscii(page, '/projects/');
  const card = page.locator('article.card').first();
  const root = card.locator('[data-ascii]');
  await expect(root).toHaveAttribute('data-ascii-state', 'static', { timeout: 15_000 });
  await card.hover();
  await page.waitForTimeout(300);
  await expect(root).not.toHaveAttribute('data-ascii-effect', /.+/);
  await expect(page.locator('canvas.ascii-live')).toHaveCount(0);
});
