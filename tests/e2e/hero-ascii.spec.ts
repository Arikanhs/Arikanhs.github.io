import { expect, type Page, test } from '@playwright/test';
import { SHAPES } from '../../src/components/ascii/shapes';
import { canvasChecksum, collectProblems, openWithAscii } from './utils/ascii';

// The home page's animated ASCII background (morph.ts). Runs in installed
// Chrome (real WebGL) against the dev server; see playwright.config.ts.
const STAGE = '[data-hero-ascii]';

/** Number of canvas pixels that are not fully transparent. */
const paintedPixels = (page: Page) =>
  page.locator(`${STAGE} canvas`).evaluate((el: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = el.width;
    copy.height = el.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(el, 0, 0);
    let count = 0;
    const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count += 1;
    return count;
  });

/** Share of the canvas pixels around the stage's centre that change over 150 ms. */
const centreChange = (page: Page) =>
  page.locator(`${STAGE} canvas`).evaluate(async (el: HTMLCanvasElement) => {
    const size = Math.round(Math.min(el.width, el.height) * 0.4);
    const copy = document.createElement('canvas');
    copy.width = size;
    copy.height = size;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!;
    const snapshot = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(el, (el.width - size) / 2, (el.height - size) / 2, size, size, 0, 0, size, size);
      return ctx.getImageData(0, 0, size, size).data;
    };
    const before = snapshot();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const after = snapshot();
    let changed = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 3] !== after[i + 3]) changed += 1;
    }
    return changed / (size * size);
  });

/** Centre of the canvas pixels that are painted, in device pixels. */
const paintedCentre = (page: Page) =>
  page.locator(`${STAGE} canvas`).evaluate((el: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = el.width;
    copy.height = el.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(el, 0, 0);
    const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let x = 0;
    let y = 0;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) continue;
      const pixel = (i - 3) / 4;
      x += pixel % copy.width;
      y += Math.floor(pixel / copy.width);
      n += 1;
    }
    return { x: x / n, y: y / n };
  });

/**
 * Over a second, the largest share of pixels that changed in the left and right
 * thirds of the painted shape (compared with the start). For the bird: its wing
 * and tail, and its head and breast.
 */
const sideChanges = (page: Page) =>
  page.locator(`${STAGE} canvas`).evaluate(async (el: HTMLCanvasElement) => {
    const { width, height } = el;
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!;
    const snapshot = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(el, 0, 0);
      return ctx.getImageData(0, 0, width, height).data;
    };
    const first = snapshot();
    let [minX, maxX, minY, maxY] = [width, 0, height, 0];
    for (let i = 3; i < first.length; i += 4) {
      if (first[i] === 0) continue;
      const pixel = (i - 3) / 4;
      const [x, y] = [pixel % width, Math.floor(pixel / width)];
      [minX, maxX, minY, maxY] = [Math.min(minX, x), Math.max(maxX, x), Math.min(minY, y), Math.max(maxY, y)];
    }
    const third = Math.floor((maxX - minX) / 3);
    const sides = { left: minX, right: maxX - third };
    const result = { left: 0, right: 0 };
    for (let k = 0; k < 10; k += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const now = snapshot();
      for (const side of ['left', 'right'] as const) {
        let changed = 0;
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = sides[side]; x < sides[side] + third; x += 1) {
            const i = (y * width + x) * 4;
            if (first[i] !== now[i] || first[i + 3] !== now[i + 3]) changed += 1;
          }
        }
        result[side] = Math.max(result[side], changed / (third * (maxY - minY + 1)));
      }
    }
    return result;
  });

/**
 * Around the bird's eye (placed from the shapes' box, data-box), the share of
 * pixels that change from 1 s into the hold: the most during its wink (about 2 s
 * in), and once it is over (3.2 s in). Needs window.holdStart (see the test).
 */
const eyeChanges = (page: Page) =>
  page.locator(`${STAGE} canvas`).evaluate(async (el: HTMLCanvasElement) => {
    const start = (window as unknown as { holdStart: number }).holdStart;
    const { width, height } = el;
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!;
    const snapshot = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(el, 0, 0);
      return ctx.getImageData(0, 0, width, height).data;
    };
    const until = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, Math.max(0, start + ms - performance.now())));
    await until(1000);
    const open = snapshot();
    // The eye is at (164, 68) of the shapes' 256 x 256 box (CSS px; the canvas may be denser).
    const [left, top, size] = (el.parentElement!.dataset.box ?? '').split(',').map(Number);
    const scale = width / el.getBoundingClientRect().width;
    const eyeX = Math.round((left + (164 / 256) * size) * scale);
    const eyeY = Math.round((top + (68 / 256) * size) * scale);
    const half = Math.round(((14 / 256) * size) * scale);
    const changed = (now: Uint8ClampedArray) => {
      let count = 0;
      for (let y = eyeY - half; y < eyeY + half; y += 1) {
        for (let x = eyeX - half; x < eyeX + half; x += 1) {
          const i = (y * width + x) * 4;
          if (open[i] !== now[i] || open[i + 3] !== now[i + 3]) count += 1;
        }
      }
      return count / (4 * half * half);
    };
    let wink = 0;
    while (performance.now() < start + 2600) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      wink = Math.max(wink, changed(snapshot()));
    }
    await until(3200);
    return { wink, after: changed(snapshot()) };
  });

/**
 * The most nearly opaque pixels in the shapes' light tone (--color-faint) seen over
 * half a second; the shapes' own edge letters in that tone are at most about 60%
 * opaque. Nothing extra (like a drawn-on wing) should show up here.
 */
const lightPixels = (page: Page) =>
  page.locator(`${STAGE} canvas`).evaluate(async (el: HTMLCanvasElement) => {
    const { width, height } = el;
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-faint');
    ctx.fillRect(0, 0, 1, 1);
    const [fr, fg, fb] = ctx.getImageData(0, 0, 1, 1).data;
    let most = 0;
    for (let k = 0; k < 6; k += 1) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(el, 0, 0);
      const data = ctx.getImageData(0, 0, width, height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const near = Math.abs(data[i] - fr) < 30 && Math.abs(data[i + 1] - fg) < 30 && Math.abs(data[i + 2] - fb) < 30;
        if (near && data[i + 3] > 200) count += 1;
      }
      most = Math.max(most, count);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    return most;
  });

/**
 * The painted rows grouped into blocks, from the bottom up (gaps under `tolerance`
 * device px stay inside a block: a shape's letter rows have small gaps between
 * them). Each block's top, bottom and width, and the canvas height.
 */
const paintedBlocks = (page: Page, tolerance: number) =>
  page.locator(`${STAGE} canvas`).evaluate(
    (el: HTMLCanvasElement, tolerance) => {
      const { width, height } = el;
      const copy = document.createElement('canvas');
      copy.width = width;
      copy.height = height;
      const ctx = copy.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(el, 0, 0);
      const data = ctx.getImageData(0, 0, width, height).data;
      const blocks: { top: number; bottom: number; left: number; right: number }[] = [];
      for (let y = height - 1; y >= 0; y -= 1) {
        let [left, right] = [-1, -1];
        for (let x = 0; x < width; x += 1) {
          if (data[(y * width + x) * 4 + 3] === 0) continue;
          if (left < 0) left = x;
          right = x;
        }
        if (left < 0) continue;
        const block = blocks.at(-1);
        if (block && block.top - y <= tolerance) {
          [block.top, block.left, block.right] = [y, Math.min(block.left, left), Math.max(block.right, right)];
        } else {
          blocks.push({ top: y, bottom: y, left, right });
        }
      }
      return { height, blocks: blocks.map((b) => ({ top: b.top, bottom: b.bottom, width: b.right - b.left })) };
    },
    tolerance,
  );

/** How many of 20 frames, 120 ms apart, change any pixel in rows top to bottom (device px). */
const changingFrames = (page: Page, top: number, bottom: number) =>
  page.locator(`${STAGE} canvas`).evaluate(
    async (el: HTMLCanvasElement, [top, bottom]) => {
      const copy = document.createElement('canvas');
      copy.width = el.width;
      copy.height = el.height;
      const ctx = copy.getContext('2d', { willReadFrequently: true })!;
      const snapshot = () => {
        ctx.clearRect(0, 0, copy.width, copy.height);
        ctx.drawImage(el, 0, 0);
        return ctx.getImageData(0, top, copy.width, bottom - top + 1).data;
      };
      let previous = snapshot();
      let frames = 0;
      for (let k = 0; k < 20; k += 1) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        const now = snapshot();
        if (now.some((value, i) => value !== previous[i])) frames += 1;
        previous = now;
      }
      return frames;
    },
    [top, bottom],
  );

test('letters form the first shape, hold it for 5 seconds, then gather into the next', async ({ page }) => {
  test.setTimeout(45_000);
  const problems = collectProblems(page);
  // Record phase changes inside the page, so a slow test runner cannot skew the timing.
  await page.addInitScript(() => {
    const log: [string, number][] = [];
    (window as unknown as { phases: typeof log }).phases = log;
    new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target as HTMLElement;
        if (el.dataset.phase) log.push([`${el.dataset.shape}:${el.dataset.phase}`, performance.now()]);
      }
    }).observe(document, { subtree: true, attributeFilter: ['data-phase'] });
  });
  await openWithAscii(page, '/');
  const stage = page.locator(STAGE);
  await expect(stage).toHaveAttribute('data-hero-ascii', 'live', { timeout: 15_000 });
  const [first, second] = SHAPES.map((shape) => shape.name);
  await expect(stage).toHaveAttribute('data-shape', first);
  await expect(stage).toHaveAttribute('data-phase', 'hold', { timeout: 10_000 });
  expect(await paintedPixels(page)).toBeGreaterThan(1000);

  await expect(stage).toHaveAttribute('data-shape', second, { timeout: 10_000 });
  await expect(stage).toHaveAttribute('data-phase', 'hold', { timeout: 8_000 });
  const phases = await page.evaluate(() => (window as unknown as { phases: [string, number][] }).phases);
  const at = (name: string) => phases.find(([phase]) => phase === name)?.[1] ?? NaN;
  // The animation clock never runs ahead of real time, so the hold is at least 5 s.
  expect(at(`${first}:scatter`) - at(`${first}:hold`)).toBeGreaterThanOrEqual(4_900);
  expect(phases.map(([phase]) => phase)).toEqual([
    `${first}:enter`,
    `${first}:hold`,
    `${first}:scatter`,
    `${second}:gather`,
    `${second}:hold`,
  ]);
  expect(problems).toEqual([]);
});

test('the background is decorative and stays clear of the terminal on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openWithAscii(page, '/');
  const stage = page.locator(STAGE);
  await expect(stage).toHaveAttribute('aria-hidden', 'true');
  await expect(stage).toHaveCSS('pointer-events', 'none');
  await expect(stage).toHaveAttribute('data-phase', 'hold', { timeout: 15_000 });
  // Only the area right of the terminal has letters once the shape has formed.
  const terminalRight = (await page.locator('#hero-terminal').boundingBox())!;
  const leftmost = await page.locator(`${STAGE} canvas`).evaluate((el: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = el.width;
    copy.height = el.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(el, 0, 0);
    const { data, width } = ctx.getImageData(0, 0, copy.width, copy.height);
    let min = width;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) min = Math.min(min, ((i - 3) / 4) % width);
    return (min / width) * el.getBoundingClientRect().width;
  });
  expect(leftmost).toBeGreaterThanOrEqual(terminalRight.x + terminalRight.width);
});

test('the pause button stops the animation, and the choice is remembered', async ({ page }) => {
  await openWithAscii(page, '/');
  const pause = page.getByRole('button', { name: 'Pause animation' });
  await expect(pause).toBeVisible({ timeout: 15_000 });
  await pause.focus();
  await page.keyboard.press('Enter');
  const play = page.getByRole('button', { name: 'Play animation' });
  await expect(play).toBeVisible();

  const canvas = page.locator(`${STAGE} canvas`);
  const before = await canvasChecksum(canvas);
  await page.waitForTimeout(1_000);
  expect(await canvasChecksum(canvas)).toBe(before);

  // Paused before it formed: the reloaded page shows the finished bird, still.
  await page.reload();
  await expect(play).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(STAGE)).toHaveAttribute('data-phase', 'hold');
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(1000);

  await play.click();
  await expect(pause).toBeVisible();
});

test('with reduced motion the bird is drawn once and there is no pause button', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithAscii(page, '/');
  await expect(page.locator(STAGE)).toHaveAttribute('data-hero-ascii', 'static', { timeout: 15_000 });
  await expect(page.locator('[data-hero-ascii-toggle]')).toBeHidden();
  expect(await paintedPixels(page)).toBeGreaterThan(1000);
});

test('on a phone the shape gets its own band below the terminal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openWithAscii(page, '/');
  const stage = page.locator(STAGE);
  await expect(stage).toHaveAttribute('data-phase', 'hold', { timeout: 15_000 });
  const terminal = (await page.locator('#hero-terminal').boundingBox())!;
  const band = (await stage.boundingBox())!;
  expect(band.y + band.height - (terminal.y + terminal.height)).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('the /lab/home test page shows only the animation, filling the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = collectProblems(page);
  await openWithAscii(page, '/lab/home/', STAGE);
  const stage = page.locator(STAGE);
  await expect(stage).toHaveAttribute('data-hero-ascii', 'live', { timeout: 15_000 });
  await expect(page.locator('#hero-terminal')).toHaveCount(0);
  await expect(page.locator('main').getByRole('heading', { level: 1 })).toHaveClass(/sr-only/);
  const box = (await stage.boundingBox())!;
  const header = (await page.locator('header').first().boundingBox())!;
  expect(box.width).toBe(1280);
  expect(Math.round(box.y + box.height)).toBe(800);
  expect(Math.round(box.y)).toBe(Math.round(header.y + header.height));
  await expect(stage).toHaveAttribute('data-phase', 'hold', { timeout: 10_000 });
  expect(await paintedPixels(page)).toBeGreaterThan(1000);
  expect(problems).toEqual([]);
});

test('hovering the shape sends ripples through the letters around the mouse', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = collectProblems(page);
  // ?still: the formed shapes do not act (acts.ts), so only the ripple moves them.
  await openWithAscii(page, '/lab/home/?still', STAGE);
  const stage = page.locator(STAGE);
  await expect(stage).toHaveAttribute('data-phase', 'hold', { timeout: 15_000 });
  const box = (await stage.boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // The shape is centred on this page; with the mouse away it holds still.
  await page.mouse.move(5, 5);
  const still = await centreChange(page);
  await page.mouse.move(centre.x, centre.y);
  await expect(stage).toHaveAttribute('data-ripple', 'on');
  const rippling = await centreChange(page);
  expect(rippling).toBeGreaterThan(Math.max(0.02, still * 5));

  // Leaving the stage calms the letters again.
  await page.mouse.move(5, 5);
  await expect(stage).toHaveAttribute('data-ripple', 'off', { timeout: 3_000 });

  // Paused, nothing moves under the mouse.
  await page.getByRole('button', { name: 'Pause animation' }).click();
  await page.mouse.move(centre.x, centre.y);
  await expect(stage).toHaveAttribute('data-ripple', 'off');
  expect(await centreChange(page)).toBe(0);
  expect(problems).toEqual([]);
});

test('the bird sits still and winks, then flies off up and to the right', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const problems = collectProblems(page);
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const stage = document.querySelector<HTMLElement>('[data-hero-ascii]');
      const w = window as unknown as { holdStart?: number };
      if (w.holdStart === undefined && stage?.dataset.shape === 'bird' && stage.dataset.phase === 'hold') {
        w.holdStart = performance.now();
      }
    }).observe(document, { subtree: true, attributeFilter: ['data-phase'] });
  });
  await openWithAscii(page, '/lab/home/', STAGE);
  const stage = page.locator(STAGE);
  await expect(stage).toHaveAttribute('data-shape', 'bird', { timeout: 15_000 });
  await expect(stage).toHaveAttribute('data-phase', 'hold', { timeout: 15_000 });
  // No wing beats while it sits: both sides of the shape only twinkle (measured:
  // 0.1 to 0.3% of their pixels).
  const { left, right } = await sideChanges(page);
  expect(left).toBeLessThan(0.012);
  expect(right).toBeLessThan(0.012);
  // It winks: the eye fills in (about 7% of the pixels around it) and opens again.
  const { wink, after } = await eyeChanges(page);
  expect(wink).toBeGreaterThan(0.03);
  expect(after).toBeLessThan(0.02);

  const sitting = await lightPixels(page);

  // Its exit is a flight, not a burst: its letters move together, up and right
  // (its caption bursts on its own).
  await expect(stage).toHaveAttribute('data-phase', 'scatter', { timeout: 8_000 });
  const start = await paintedCentre(page);
  const flying = await lightPixels(page);
  // Its caption bursts instead of flying with it: the word (about 56 x 320 px) is
  // no longer anywhere in one piece.
  const { blocks } = await paintedBlocks(page, 16);
  const word = blocks.find((b) => b.bottom - b.top > 40 && b.bottom - b.top < 75 && b.width > 250 && b.width < 360);
  expect(word).toBeUndefined();
  await page.waitForTimeout(300);
  const later = await paintedCentre(page);
  // No wing is drawn on (its own wing beats: see acts.spec.ts).
  expect(sitting).toBeLessThan(50);
  expect(flying).toBeLessThan(50);
  expect(later.x - start.x).toBeGreaterThan(20);
  expect(later.y - start.y).toBeLessThan(-20);
  expect(problems).toEqual([]);
});

test('each shape has its caption in big flickering letters, halfway between it and the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openWithAscii(page, '/lab/home/', STAGE);
  const stage = page.locator(STAGE);
  await expect(stage).toHaveAttribute('data-phase', 'hold', { timeout: 15_000 });
  // The bird's caption, FREEDOM: pixel letters five 12 px cells tall, 27 cells wide.
  const { height, blocks } = await paintedBlocks(page, 16);
  const [caption, bird] = blocks;
  expect(caption.bottom - caption.top).toBeGreaterThan(48);
  expect(caption.bottom - caption.top).toBeLessThan(72);
  expect(caption.width).toBeGreaterThan(280);
  expect(caption.width).toBeLessThan(340);
  // Halfway (to a cell) between the bottom of the bird and the bottom of the page.
  expect(Math.abs((caption.top + caption.bottom) / 2 - (bird.bottom + height) / 2)).toBeLessThan(14);
  expect(bird.bottom - bird.top).toBeGreaterThan(300);
  // Its letters flicker now and then, like the shape's.
  expect(await changingFrames(page, caption.top, caption.bottom)).toBeGreaterThan(2);
});

test.describe('on a high-density screen', () => {
  test.use({ deviceScaleFactor: 2 });

  test('the canvas still fills the stage after a resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openWithAscii(page, '/lab/home/', STAGE);
    const stage = page.locator(STAGE);
    await expect(stage).toHaveAttribute('data-hero-ascii', 'live', { timeout: 15_000 });
    for (const width of [375, 1000]) {
      const grid = (await stage.getAttribute('data-grid'))!;
      await page.setViewportSize({ width, height: 800 });
      // Wait until the animation has handled the resize, then compare sizes.
      await expect(stage).not.toHaveAttribute('data-grid', grid);
      const box = (await stage.boundingBox())!;
      expect((await page.locator(`${STAGE} canvas`).boundingBox())!.width).toBe(box.width);
    }
  });
});

