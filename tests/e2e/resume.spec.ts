import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { getDocumentProxy } from 'unpdf';
import { DIST } from './utils/site';

// Stage 8: /resume from src/data/resume.yaml, the print stylesheet and cv.pdf.

test('the resume shows every section from resume.yaml, with timelines', async ({ page }) => {
  await page.goto('/resume/');
  for (const name of ['Education', 'Experience', 'Projects and involvement', 'Publications', 'Skills', 'Awards and certifications']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  const yaml = fs.readFileSync(path.resolve(import.meta.dirname, '../../src/data/resume.yaml'), 'utf8');
  const roles = yaml.split('\n  involvement:')[0].split('\n  experience:')[1].match(/^\s+- title:/gm) ?? [];
  const experience = page.locator('section', { has: page.getByRole('heading', { name: 'Experience' }) });
  await expect(experience.locator('.timeline > li')).toHaveCount(roles.length);
  await expect(experience.locator('time').first()).toHaveAttribute('datetime', /^\d{4}(-\d{2})?$/);
});

test('Download PDF points at cv.pdf, which exists and names the owner', async ({ page }) => {
  await page.goto('/resume/');
  await expect(page.getByRole('link', { name: /Download PDF/ })).toHaveAttribute('href', '/cv.pdf');
  const file = path.join(DIST, 'cv.pdf');
  expect(fs.existsSync(file)).toBe(true);
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)));
  const first = await (await pdf.getPage(1)).getTextContent();
  expect(first.items.map((item) => ('str' in item ? item.str : '')).join(' ')).toContain('Hasan Serdar Arikan');
});

for (const format of ['A4', 'Letter'] as const) {
  test(`print fits ${format}: two pages at most, no site chrome, nothing clipped`, async ({ page }) => {
    await page.goto('/resume/');
    const buffer = await page.pdf({ format, margin: { top: '14mm', bottom: '14mm', left: '15mm', right: '15mm' } });
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    expect(pdf.numPages).toBeLessThanOrEqual(2);

    // Lay the page out at the printable width and check for overflow.
    const printableMm = format === 'A4' ? 210 - 30 : 215.9 - 30;
    await page.setViewportSize({ width: Math.floor((printableMm / 25.4) * 96), height: 1000 });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.site-footer')).toBeHidden();
    await expect(page.locator('.print-name')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
