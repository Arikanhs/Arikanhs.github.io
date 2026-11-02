import { expect, test } from '@playwright/test';
import { builtPages } from './utils/site';

// Every built page loads with status 200, has exactly one h1, logs no console
// errors, requests nothing that fails, and has no horizontal overflow at 375px.
for (const route of builtPages()) {
  test(`smoke ${route}`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('response', (res) => {
      if (res.url().startsWith(baseURL!) && res.status() >= 400) {
        errors.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto(route, { waitUntil: 'load' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.title()).not.toBe('');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow at 375px').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}
