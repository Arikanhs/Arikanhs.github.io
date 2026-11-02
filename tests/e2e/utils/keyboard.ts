import type { Page } from '@playwright/test';

/**
 * Presses Tab through the page and reports which focusable elements were
 * reached. "Expected" is every rendered link and enabled button, including
 * visually hidden ones such as the skip link (they are still in the tab order).
 */
export async function tabThroughPage(page: Page) {
  const expected = await page.evaluate(() => {
    const els = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(
      (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
    );
    return els.map((el, i) => {
      el.dataset.tabId = String(i);
      return `${i}:${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim().replace(/\s+/g, ' ')}`;
    });
  });

  const reached = new Set<string>();
  for (let press = 0; press < expected.length + 5; press += 1) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.tabId);
    if (id !== undefined) reached.add(id);
  }
  const missed = expected.filter((label) => !reached.has(label.split(':')[0]));
  return { expected, missed };
}
