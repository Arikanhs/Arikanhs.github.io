import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { builtHtml, builtPages, DIST } from './utils/site';

// Stage 12: launch polish (production build).
const SITE = 'https://arikanhs.github.io';
const attr = (html: string, pattern: RegExp) => pattern.exec(html)?.[1];

test('every page has its own title, a description, a canonical URL and Open Graph tags', () => {
  const titles = new Set<string>();
  for (const route of builtPages()) {
    const html = builtHtml(route);
    const title = attr(html, /<title>([^<]+)<\/title>/);
    expect(title, route).toBeTruthy();
    titles.add(title!);
    expect(attr(html, /<meta name="description" content="([^"]+)"/), route).toBeTruthy();
    expect(attr(html, /<link rel="canonical" href="([^"]+)"/), route).toBe(`${SITE}${route}`);
    expect(attr(html, /<meta property="og:url" content="([^"]+)"/), route).toBe(`${SITE}${route}`);
    expect(attr(html, /<meta property="og:title" content="([^"]+)"/), route).toBeTruthy();
    expect(attr(html, /<meta property="og:image" content="([^"]+)"/), route).toMatch(/^https:\/\/.+\.png$/);
    expect(attr(html, /<meta name="twitter:card" content="([^"]+)"/), route).toBe('summary_large_image');
  }
  expect(titles.size).toBe(builtPages().length);
});

test('blog posts are typed as articles with a publication date', () => {
  const html = builtHtml('/blog/stable-softmax/');
  expect(html).toContain('<meta property="og:type" content="article"');
  expect(html).toMatch(/<meta property="article:published_time" content="2026-10-28/);
});

test('robots.txt, the sitemap, the manifest and the favicon set exist', () => {
  const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap-0.xml'), 'utf8');
  for (const route of builtPages()) expect(sitemap).toContain(`<loc>${SITE}${route}</loc>`);
  expect(sitemap).not.toContain('404');
  for (const file of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og.png']) {
    expect(fs.existsSync(path.join(DIST, file)), file).toBe(true);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'site.webmanifest'), 'utf8'));
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512']);
});

test('the social preview image is 1200x630', () => {
  const png = fs.readFileSync(path.join(DIST, 'og.png'));
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('unknown URLs get the terminal-style 404 page, kept out of search', async ({ page }) => {
  const response = await page.goto('/no/such/page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('404: page not found');
  await expect(page.getByText('cd /no/such/page/')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  for (const href of ['/', '/projects/', '/publications/', '/blog/', '/resume/']) {
    await expect(page.locator(`.dirs a[href="${href}"]`)).toBeVisible();
  }
});

test('the 404 page passes axe at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/no/such/page/');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
