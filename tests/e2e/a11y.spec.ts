import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { builtPages } from './utils/site';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

for (const width of [375, 1280]) {
  for (const route of builtPages()) {
    test(`axe ${route} @${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route, { waitUntil: 'load' });
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const summary = violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      );
      expect(summary).toEqual([]);
    });
  }
}
