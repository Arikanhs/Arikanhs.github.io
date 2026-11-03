import { expect, test, type Page } from '@playwright/test';

// The home page and every tab have their own color themes (global.css); the rest
// of the site (the 404 page) is plain cream. The pages' backgrounds are gradients, which axe
// cannot check, so the contrast of every token pair is checked here instead.

const PAGES = [
  { path: '/', theme: 'home' },
  { path: '/projects/', theme: 'projects' },
  { path: '/projects/gcn-cuda-tuning/', theme: 'projects' },
  { path: '/publications/', theme: 'publications' },
  { path: '/blog/', theme: 'blog' },
  { path: '/blog/stable-softmax/', theme: 'blog' },
  { path: '/resume/', theme: 'resume' },
  { path: '/404.html', theme: null },
];

/** Contrast failures among the page's tokens (WCAG AA, 4.5:1), as readable strings. */
function contrastFailures(page: Page) {
  return page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgb = (color: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const token = (name: string) => rgb(getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`));
    const luminance = (c: number[]) => {
      const [r, g, b] = c.map((v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };

    const failures: string[] = [];
    const check = (text: string, ground: string, a: number[], b: number[]) => {
      const r = ratio(a, b);
      if (r < 4.5) failures.push(`${text} on ${ground}: ${r.toFixed(2)}`);
    };
    const grounds = ['bg', 'bg-end', 'surface', 'surface-2'];
    for (const text of ['fg', 'muted', 'faint', 'accent-text'])
      for (const ground of grounds) check(text, ground, token(text), token(ground));
    for (const fill of ['accent', 'accent-strong']) check('accent-ink', fill, token('accent-ink'), token(fill));

    // Pages with ASCII art (ProjectCard, the project page hero): text sits on a
    // scrim of 90% page background over the brightest glyph on a dark page, the
    // darkest on a light one.
    if (document.querySelector('[data-ascii]')) {
      const bg = token('bg');
      const glyph = luminance(bg) < 0.18 ? [255, 255, 255] : [0, 0, 0];
      const scrim = bg.map((v, i) => v * 0.9 + glyph[i]! * 0.1);
      for (const text of ['fg', 'muted']) check(text, 'card scrim', token(text), scrim);
    }

    // Highlighted code: every token on its block's background (code-theme.ts).
    for (const pre of document.querySelectorAll<HTMLElement>('pre.astro-code')) {
      const ground = rgb(getComputedStyle(pre).backgroundColor);
      for (const span of pre.querySelectorAll<HTMLElement>('span[style]')) {
        if (!span.textContent?.trim()) continue;
        check(`code "${span.textContent.trim()}"`, 'code block', rgb(getComputedStyle(span).color), ground);
      }
    }
    return failures;
  });
}

for (const { path, theme } of PAGES) {
  test(`${path} uses the ${theme ?? 'cream'} theme`, async ({ page }) => {
    await page.goto(path);
    const html = page.locator('html');
    if (theme) await expect(html).toHaveAttribute('data-theme', theme);
    else await expect(html).not.toHaveAttribute('data-theme');
    // The browser UI matches the left end of the page's wash.
    const [meta, bg] = await page.evaluate(() => {
      const probe = document.createElement('i');
      document.body.append(probe);
      const resolve = (color: string) => {
        probe.style.color = color;
        return getComputedStyle(probe).color;
      };
      const content = document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? '';
      return [resolve(content), resolve('var(--color-bg)')];
    });
    expect(meta).toBe(bg);
    expect(await contrastFailures(page)).toEqual([]);
  });
}

test('the page background washes from left to right', async ({ page }) => {
  const wash = async (path: string) => {
    await page.goto(path);
    return page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  };
  // Sapphire into ocean blue, sky blue into cloudy white, red orange into snowy white,
  // onyx into electric indigo, deep violet into black.
  expect(await wash('/')).toContain('linear-gradient(to right, rgb(15, 82, 186), rgb(3, 94, 140))');
  expect(await wash('/projects/')).toContain('linear-gradient(to right, rgb(135, 206, 235), rgb(243, 246, 249))');
  expect(await wash('/publications/')).toContain('linear-gradient(to right, rgb(255, 83, 73), rgb(255, 250, 250))');
  expect(await wash('/resume/')).toContain('linear-gradient(to right, rgb(20, 20, 22), rgb(111, 0, 255))');
  expect(await wash('/blog/')).toContain('linear-gradient(to right, rgb(42, 10, 107), rgb(9, 9, 11))');
  // Plain cream stays flat.
  expect(await wash('/404.html')).toContain('linear-gradient(to right, rgb(245, 239, 227), rgb(245, 239, 227))');
});

test('the resume still prints black on white', async ({ page }) => {
  await page.goto('/resume/');
  await page.emulateMedia({ media: 'print' });
  const colors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return { page: root.backgroundColor, text: getComputedStyle(document.body).color, scheme: root.colorScheme };
  });
  expect(colors).toEqual({ page: 'rgb(255, 255, 255)', text: 'rgb(17, 17, 17)', scheme: 'light' });
});

test('the theme follows client-side navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'home');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: /^projects$/i }).click();
  await expect(page).toHaveURL('/projects/');
  await expect(html).toHaveAttribute('data-theme', 'projects');
  await nav.getByRole('link', { name: /^blog$/i }).click();
  await expect(page).toHaveURL('/blog/');
  await expect(html).toHaveAttribute('data-theme', 'blog');
  await page.goBack();
  await expect(html).toHaveAttribute('data-theme', 'projects');
});
