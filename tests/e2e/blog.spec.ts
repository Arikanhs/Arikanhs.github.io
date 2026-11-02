import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST } from './utils/site';

// Stage 10: the blog (production build; drafts are also checked on the dev server).
const DIR = path.resolve(import.meta.dirname, '../../src/content/blog');
const DEV = 'http://127.0.0.1:4322';
const posts = fs
  .readdirSync(DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const text = fs.readFileSync(path.join(DIR, file), 'utf8');
    return {
      id: file.replace(/\.md$/, ''),
      date: /^date:\s*(\S+)/m.exec(text)![1],
      draft: /^draft:\s*true/m.test(text),
    };
  });
const published = posts.filter((p) => !p.draft).sort((a, b) => b.date.localeCompare(a.date));
const drafts = posts.filter((p) => p.draft);
const POST = '/blog/stable-softmax/';

test('/blog lists published posts newest first with date, reading time and tags', async ({ page }) => {
  await page.goto('/blog/');
  const items = page.getByRole('list', { name: 'Posts' }).getByRole('listitem').filter({ has: page.locator('article') });
  const links = await items.locator('h2 a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).pathname));
  expect(links).toEqual(published.map((p) => `/blog/${p.id}/`));
  for (const item of await items.all()) {
    await expect(item.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    await expect(item).toContainText(/\d+ min read/);
    await expect(item.getByRole('list', { name: 'Tags' })).toBeVisible();
  }
});

test('drafts are left out of the production build but shown in development', async ({ request }) => {
  expect(drafts.length).toBeGreaterThan(0);
  for (const draft of drafts) {
    expect(fs.existsSync(path.join(DIST, 'blog', draft.id))).toBe(false);
    expect(fs.readFileSync(path.join(DIST, 'rss.xml'), 'utf8')).not.toContain(`/blog/${draft.id}/`);
    const dev = await request.get(`${DEV}/blog/`);
    expect(await dev.text()).toContain(`/blog/${draft.id}/`);
  }
});

test('a long post has a table of contents whose links all land on headings', async ({ page }) => {
  await page.goto(POST);
  const toc = page.getByRole('navigation', { name: 'On this page' });
  const hrefs = await toc.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThanOrEqual(3);
  for (const href of hrefs) await expect(page.locator(`.body ${href}`)).toHaveCount(1);
  await page.goto('/blog/hello-world/');
  await expect(page.getByRole('navigation', { name: 'On this page' })).toHaveCount(0);
});

test('code is highlighted and the copy button copies it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(POST);
  const block = page.locator('.code-block').first();
  await expect(block.locator('pre span[style*="color"]').first()).toBeVisible();
  await block.getByRole('button', { name: 'Copy code' }).click();
  await expect(block.getByRole('button', { name: 'Copy code' })).toHaveText('Copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('def softmax(z: np.ndarray');
  expect(copied).not.toContain('Copy');
});

test('math renders with KaTeX, with MathML for screen readers', async ({ page }) => {
  await page.goto(POST);
  await expect(page.locator('.katex-display').first()).toBeVisible();
  expect(await page.locator('.katex').count()).toBeGreaterThan(5);
  await expect(page.locator('.katex math').first()).toBeAttached();
  await expect(page.locator('.katex-display').first()).toContainText('softmax');
});

test('body text runs about 70 characters per line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(POST);
  const perLine = await page.locator('.body > p').nth(1).evaluate((p) => {
    const style = getComputedStyle(p);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const sample = 'Adding the same constant to every score does not change the softmax, so subtract';
    return p.clientWidth / (ctx.measureText(sample).width / sample.length);
  });
  expect(perLine).toBeGreaterThan(60);
  expect(perLine).toBeLessThan(80);
});

test('tag pages list their posts', async ({ page }) => {
  await page.goto(POST);
  await page.getByRole('list', { name: 'Tags' }).getByRole('link', { name: 'math' }).click();
  await expect(page).toHaveURL('/blog/tags/math/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/#math/);
  await expect(page.locator(`h2 a[href="${POST}"]`)).toBeVisible();
});

test('/rss.xml loads as RSS with every published post', async ({ request }) => {
  const response = await request.get('/rss.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/xml/);
  const xml = await response.text();
  expect(xml).toMatch(/^<\?xml/);
  expect((xml.match(/<item>/g) ?? []).length).toBe(published.length);
  for (const post of published) expect(xml).toContain(`https://arikanhs.github.io/blog/${post.id}/`);
});

test('posts fit at 375px, including wide formulas and code', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(POST);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
