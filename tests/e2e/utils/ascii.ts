import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Opens a page on the dev server once it has content. Right after `astro dev`
 * starts it may still be syncing the content store, and a page rendered in that
 * window has no ASCII roots; retry until it does.
 */
export async function openWithAscii(page: Page, path: string) {
  await expect(async () => {
    await page.goto(path, { timeout: 10_000 });
    await expect(page.locator('[data-ascii]').first()).toBeAttached({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** A cheap checksum of a canvas's pixels, to tell whether the output changed. */
export async function canvasChecksum(canvas: Locator) {
  return canvas.evaluate((el: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = el.width;
    copy.height = el.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(el, 0, 0);
    let sum = 0;
    for (const v of ctx.getImageData(0, 0, copy.width, copy.height).data) sum = (sum * 31 + v) % 1_000_000_007;
    return sum;
  });
}

/** Console warnings/errors and page errors seen by a page. */
export function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning' || msg.type() === 'error') problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}
