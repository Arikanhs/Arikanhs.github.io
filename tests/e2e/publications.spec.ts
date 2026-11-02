import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { parseBibtex } from '../../src/lib/bibtex';

// Stage 9: /publications (production build).
const DIR = path.resolve(import.meta.dirname, '../../src/content/publications');
const sources = fs
  .readdirSync(DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const text = fs.readFileSync(path.join(DIR, file), 'utf8');
    const field = (name: string) => new RegExp(`^${name}:\\s*(.+?)\\s*(?:#.*)?$`, 'm').exec(text)?.[1];
    const bibtex = /^bibtex: \|\n((?: {2}.*\n?)+)/m.exec(text)?.[1].replace(/^ {2}/gm, '').trim();
    const tags = (field('tags') ?? '').replace(/^\[|\]$/g, '').split(',').map((tag) => tag.trim());
    return { id: file.replace(/\.md$/, ''), repo: field('repo'), year: Number(field('year')), project: field('projectSlug'), tags, bibtex };
  });

test('grouped by year, newest first, with the owner in bold', async ({ page }) => {
  await page.goto('/publications/');
  const years = await page.locator('.year-title').allInnerTexts();
  const expected = [...new Set(sources.map((s) => s.year))].sort((a, b) => b - a).map(String);
  expect(years).toEqual(expected);
  for (const entry of await page.locator('.entry').all()) {
    await expect(entry.locator('.authors strong')).toHaveText(/Hasan.*Arikan/);
  }
});

test('every Code button opens the repo from that entry, Project buttons open the project', async ({ page }) => {
  await page.goto('/publications/');
  for (const source of sources) {
    const entry = page.locator(`#${source.id}`);
    await expect(entry.getByRole('link', { name: /^Code for/ })).toHaveAttribute('href', source.repo!);
    if (source.project) {
      await expect(entry.getByRole('link', { name: /^Project page for/ })).toHaveAttribute(
        'href',
        `/projects/${source.project}/`,
      );
    }
  }
});

test('Copy BibTeX copies valid BibTeX, identical to the source, and confirms with a toast', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/publications/');
  for (const source of sources) {
    await page.locator(`#${source.id}`).getByRole('button', { name: 'Copy BibTeX' }).click();
    await expect(page.getByRole('status')).toHaveText(/BibTeX copied/);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(source.bibtex);
    const entry = parseBibtex(copied);
    expect(entry, 'parses as BibTeX').not.toBeNull();
    expect(entry!.fields.year).toBe(String(source.year));
    expect((copied.match(/{/g) ?? []).length).toBe((copied.match(/}/g) ?? []).length);
  }
});

test('tag chips filter the list and can be reset', async ({ page }) => {
  await page.goto('/publications/');
  const total = await page.locator('.entry').count();
  const chip = page.getByRole('button', { name: 'Kokkos', exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.entry:visible')).toHaveCount(sources.filter((s) => s.tags.includes('Kokkos')).length);
  await page.getByRole('button', { name: 'all', exact: true }).click();
  await expect(page.locator('.entry:visible')).toHaveCount(total);
});

test('an open BibTeX block does not widen the page at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/publications/');
  for (const summary of await page.locator('.bibtex summary').all()) await summary.click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('BibTeX is still readable and nothing is filtered', async ({ page }) => {
    await page.goto('/publications/');
    await expect(page.getByRole('button', { name: 'Copy BibTeX' })).toHaveCount(0);
    await expect(page.locator('[data-filters]')).toBeHidden();
    await page.locator('.bibtex summary').first().click();
    await expect(page.locator('[data-bibtex]').first()).toContainText('@inproceedings');
  });
});
