import { expect, test } from '@playwright/test';
import { SITE } from '../../src/lib/site';

// Stage 7: the terminal hero on the home page (production build).
const terminal = '#hero-terminal';

test('all hero text is in the served HTML, before any script runs', async ({ request }) => {
  const html = await (await request.get('/')).text();
  for (const text of ['whoami', SITE.name, SITE.focus.join(' · '), SITE.status, 'github', 'email', 'cv']) {
    expect(html, text).toContain(text.replace(/'/g, '&#39;'));
  }
  expect(html).toContain(SITE.intro.replace(/'/g, '&#39;').slice(0, 40));
});

test('the session types once per visit, then shows the final state', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(terminal)).toHaveClass(/is-typing/);
  const links = page.locator(`${terminal} .links`);
  await expect(links).toHaveCSS('opacity', '1', { timeout: 5_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(SITE.name);

  await page.reload();
  await expect(page.locator(terminal)).not.toHaveClass(/is-typing/);
});

test('with reduced motion the final text shows immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator(terminal)).not.toHaveClass(/is-typing/);
  for (const out of await page.locator(`${terminal} .out`).all()) {
    await expect(out).toHaveCSS('opacity', '1');
  }
});

test.describe('without JavaScript at 375px', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });

  test('the hero is complete and fits', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(SITE.name);
    await expect(page.getByText('whoami')).toBeVisible();
    await expect(page.locator(`${terminal} dd`).first()).toBeVisible();
    const box = await page.locator(terminal).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('hero links point at GitHub, email and the CV', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator(terminal);
  await expect(hero.getByRole('link', { name: /github/ })).toHaveAttribute('href', SITE.githubUrl);
  await expect(hero.getByRole('link', { name: 'email' })).toHaveAttribute('href', `mailto:${SITE.email}`);
  await expect(hero.getByRole('link', { name: 'cv' })).toHaveAttribute('href', /^\/(resume\/|cv\.pdf)$/);
});

test('without hardware WebGL the background shows the bird once, with no pause button', async ({ page }) => {
  // Playwright's headless shell only has software WebGL, which counts as none.
  await page.goto('/');
  await expect(page.locator('[data-hero-ascii]')).toHaveAttribute('data-hero-ascii', 'static', { timeout: 10_000 });
  await expect(page.locator('[data-hero-ascii-toggle]')).toBeHidden();
});
