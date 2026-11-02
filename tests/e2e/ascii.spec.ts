import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { DIST } from './utils/site';

// Runs in the "chrome-gpu" project: installed Chrome with a real GPU, against
// `astro dev`, because /lab/ascii only exists in development.
const LAB = '/lab/ascii';
const roots = (page: Page) => page.locator('[data-ascii]');

// One worker, in order: keeps GPU load and the number of WebGL contexts low.
test.describe.configure({ mode: 'default' });

/** Records console warnings/errors and whether textmode.js was downloaded. */
function watch(page: Page) {
  const log = { problems: [] as string[], textmodeRequested: false };
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') log.problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => log.problems.push(`pageerror: ${err.message}`));
  page.on('request', (req) => {
    if (/\/deps\/textmode|textmode\.js/.test(req.url())) log.textmodeRequested = true;
  });
  return log;
}

/**
 * Opens the lab. Right after the dev server starts it may still be syncing the
 * content store, and a page rendered in that window has no covers; retry until
 * it does.
 */
async function openLab(page: Page) {
  await expect(async () => {
    await page.goto(LAB, { timeout: 10_000 });
    await expect(roots(page).first()).toBeAttached({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

async function showAll(page: Page, state: 'live' | 'static') {
  const count = await roots(page).count();
  for (let i = 0; i < count; i += 1) {
    await roots(page).nth(i).scrollIntoViewIfNeeded();
    await expect(roots(page).nth(i)).toHaveAttribute('data-ascii-state', state, { timeout: 15_000 });
  }
  return count;
}

/** A cheap checksum of a canvas's pixels, to tell whether the output changed. */
async function pixelSum(page: Page, rootIndex: number) {
  return roots(page)
    .nth(rootIndex)
    .locator('canvas.ascii-live')
    .evaluate((canvas: HTMLCanvasElement) => {
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const ctx = copy.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(canvas, 0, 0);
      let sum = 0;
      for (const v of ctx.getImageData(0, 0, copy.width, copy.height).data) sum = (sum * 31 + v) % 1_000_000_007;
      return sum;
    });
}

/** Share of a canvas's pixels that are glyph "ink", and how many distinct hues they use. */
async function inkStats(page: Page, rootIndex: number, canvasClass: 'ascii-live' | 'ascii-static') {
  return roots(page)
    .nth(rootIndex)
    .locator(`canvas.${canvasClass}`)
    .evaluate((canvas: HTMLCanvasElement) => {
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const ctx = copy.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(canvas, 0, 0);
      const px = ctx.getImageData(0, 0, copy.width, copy.height).data;
      let ink = 0;
      const hues = new Set<number>();
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max < 40) continue; // background (#0d0c0b) and near-black
        ink += 1;
        if (max - min > 40) {
          const hue = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
          hues.add(Math.round(((hue * 60 + 360) % 360) / 30)); // 12 buckets
        }
      }
      return { ink: ink / (px.length / 4), hues: hues.size };
    });
}

test('renders live, colored ASCII on every cover with a clean console', async ({ page }) => {
  const log = watch(page);
  await openLab(page);
  const count = await showAll(page, 'live');
  expect(count).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < count; i += 1) {
    const stats = await inkStats(page, i, 'ascii-live');
    expect(stats.ink, `cover ${i} has glyphs`).toBeGreaterThan(0.05);
    expect(stats.hues, `cover ${i} is colored`).toBeGreaterThanOrEqual(2);
  }
  expect(log.textmodeRequested).toBe(true);
  expect(log.problems).toEqual([]);
});

test('reduced motion shows the static fallback and never loads textmode.js', async ({ page }) => {
  const log = watch(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLab(page);
  const count = await showAll(page, 'static');
  for (let i = 0; i < count; i += 1) {
    expect((await inkStats(page, i, 'ascii-static')).ink).toBeGreaterThan(0.05);
  }
  await expect(page.locator('canvas.ascii-live')).toHaveCount(0);
  expect(log.textmodeRequested).toBe(false);
  expect(log.problems).toEqual([]);
});

test('turning reduced motion on at runtime swaps live for static, and back', async ({ page }) => {
  await openLab(page);
  const first = roots(page).first();
  await expect(first).toHaveAttribute('data-ascii-state', 'live', { timeout: 15_000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(first).toHaveAttribute('data-ascii-state', 'static');
  await expect(first.locator('canvas.ascii-live')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(first).toHaveAttribute('data-ascii-state', 'live', { timeout: 15_000 });
});

test('falls back to the static version when WebGL2 is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...args);
    } as typeof original;
  });
  const log = watch(page);
  await openLab(page);
  await showAll(page, 'static');
  expect((await inkStats(page, 0, 'ascii-static')).ink).toBeGreaterThan(0.05);
  expect(log.textmodeRequested).toBe(false);
});

test('a box far below the fold stays idle until it nears the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openLab(page);
  await expect(roots(page).first()).toHaveAttribute('data-ascii-state', 'live', { timeout: 15_000 });
  const last = roots(page).last();
  await expect(last).toHaveAttribute('data-ascii-state', 'idle');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveAttribute('data-ascii-state', 'live', { timeout: 15_000 });
});

test('leaving the page releases every WebGL context', async ({ page }) => {
  await openLab(page);
  const count = await showAll(page, 'live');
  const lost = await page.evaluate(() => {
    const contexts = [...document.querySelectorAll<HTMLCanvasElement>('canvas.ascii-live')].map((canvas) =>
      canvas.getContext('webgl2'),
    );
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    return contexts.map((gl) => !!gl && gl.isContextLost());
  });
  expect(lost).toEqual(Array(count).fill(true));
  await expect(page.locator('canvas.ascii-live')).toHaveCount(0);
  await expect(roots(page).first()).toHaveAttribute('data-ascii-state', 'static');
});

test('the cell-size slider, character set and renderer switch update the output', async ({ page }) => {
  await openLab(page);
  const first = roots(page).first();
  await expect(first).toHaveAttribute('data-ascii-state', 'live', { timeout: 15_000 });
  const [cols8] = (await first.getAttribute('data-ascii-grid'))!.split('x').map(Number);

  await page.getByLabel(/Cell size/).fill('16');
  await expect
    .poll(async () => Number((await first.getAttribute('data-ascii-grid'))!.split('x')[0]))
    .toBeLessThan(cols8 * 0.6);

  const before = await pixelSum(page, 0);
  await page.getByLabel('Character set, dark to bright').fill(' @');
  await expect.poll(() => pixelSum(page, 0)).not.toBe(before);

  await page.getByLabel('Canvas 2D fallback').check();
  await expect(first).toHaveAttribute('data-ascii-state', 'static');
  await page.getByLabel('WebGL when allowed').check();
  await expect(first).toHaveAttribute('data-ascii-state', 'live', { timeout: 15_000 });
});

test('the production build has no lab page', () => {
  expect(fs.existsSync(`${DIST}/lab`)).toBe(false);
});
