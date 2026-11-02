import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '../..');
const projectFiles = fs
  .readdirSync(path.join(ROOT, 'src/content/projects'))
  .filter((file) => file.endsWith('.md'));

function frontmatter(file: string, field: string): string | undefined {
  const text = fs.readFileSync(path.join(ROOT, 'src/content/projects', file), 'utf8');
  return new RegExp(`^${field}:\\s*(.+?)\\s*(?:#.*)?$`, 'm').exec(text)?.[1];
}

test('/projects lists every project, sorted by order, with title, summary, tags and repo', async ({ page }) => {
  await page.goto('/projects/');
  const cards = page.getByRole('list', { name: 'Projects' }).getByRole('article');
  await expect(cards).toHaveCount(projectFiles.length);

  const expectedTitles = projectFiles
    .map((file) => ({ title: frontmatter(file, 'title'), order: Number(frontmatter(file, 'order')) }))
    .sort((a, b) => a.order - b.order)
    .map((p) => p.title);
  await expect(cards.getByRole('heading', { level: 2 })).toHaveText(expectedTitles as string[]);

  for (const card of await cards.all()) {
    await expect(card.locator('p')).not.toBeEmpty();
    await expect(card.getByRole('list', { name: 'Tags' }).getByRole('listitem').first()).toBeVisible();
    await expect(card.getByRole('link')).toHaveAttribute('href', /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/);
  }
});

// Each case copies the site into the test's output folder, breaks one entry and
// runs `astro sync`, which loads and validates every content collection.
// `fails: false` cases must still report the error. (Astro logs broken references
// instead of failing; the pages that resolve projectSlug turn them into failures.)
const cases = [
  { name: 'unchanged content passes', file: null, edit: (s: string) => s, error: null, fails: false },
  {
    name: 'a project without its required summary fails',
    file: 'projects/image2ascii.md',
    edit: (s: string) => s.replace(/^summary:.*\n/m, ''),
    error: /summary/,
    fails: true,
  },
  {
    name: 'a non-GitHub repo URL fails',
    file: 'projects/gcn-cuda-tuning.md',
    edit: (s: string) => s.replace(/^repo:.*$/m, 'repo: https://gitlab.com/someone/thing'),
    error: /repo/,
    fails: true,
  },
  {
    name: 'a publication pointing at a missing project is reported',
    file: 'publications/kokkos-ipdpsw-2024.md',
    edit: (s: string) => s.replace(/^projectSlug:.*$/m, 'projectSlug: no-such-project'),
    error: /Invalid content reference.*no-such-project/,
    fails: false,
  },
  {
    name: 'malformed BibTeX fails',
    file: 'publications/gcn-cuda-hpec-2025.md',
    edit: (s: string) => s.replace('year      = {2025},', 'year      = {2025,'),
    error: /bibtex/,
    fails: true,
  },
];

for (const c of cases) {
  test(`content schema: ${c.name}`, async ({}, testInfo) => {
    test.setTimeout(90_000);
    const site = testInfo.outputPath('site');
    fs.mkdirSync(site, { recursive: true });
    for (const file of ['astro.config.mjs', 'package.json', 'tsconfig.json']) {
      fs.copyFileSync(path.join(ROOT, file), path.join(site, file));
    }
    fs.cpSync(path.join(ROOT, 'src'), path.join(site, 'src'), { recursive: true });
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(site, 'node_modules'), 'dir');
    if (c.file) {
      const target = path.join(site, 'src/content', c.file);
      const before = fs.readFileSync(target, 'utf8');
      const after = c.edit(before);
      expect(after, 'the edit must change the file').not.toBe(before);
      fs.writeFileSync(target, after);
    }

    const run = spawnSync('npx', ['astro', 'sync'], { cwd: site, encoding: 'utf8' });
    const output = `${run.stdout}\n${run.stderr}`;
    if (c.fails) expect(run.status, output).not.toBe(0);
    else expect(run.status, output).toBe(0);
    if (c.error) expect(output).toMatch(c.error);
    else expect(output).not.toMatch(/error/i);
  });
}
