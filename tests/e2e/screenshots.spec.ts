import { test } from '@playwright/test';
import { builtPages, routeSlug } from './utils/site';

// Not a check: captures full-page screenshots for manual review.
//   SCREENSHOTS=1 npm test -- screenshots
//   SCREENSHOTS=1 SHOT_ROUTES=/,/projects/ npm test -- screenshots
const routes = process.env.SHOT_ROUTES?.split(',') ?? builtPages();

test.describe('screenshots', () => {
  test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture screenshots');

  for (const width of [375, 1280]) {
    for (const route of routes) {
      test(`${route} @${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 600 ? 812 : 800 });
        await page.goto(route, { waitUntil: 'networkidle' });
        await page.screenshot({
          path: `tests/screenshots/${routeSlug(route)}-${width}.png`,
          fullPage: true,
        });
      });
    }
  }
});
