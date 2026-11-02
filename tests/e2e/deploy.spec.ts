import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import config from '../../astro.config.mjs';
import { SITE } from '../../src/lib/site';

const workflow = fs.readFileSync(
  path.resolve(import.meta.dirname, '../../.github/workflows/deploy.yml'),
  'utf8',
);

test('site is the GitHub Pages user site for the GitHub username', () => {
  expect(config.site).toBe(`https://${SITE.github.toLowerCase()}.github.io`);
  expect(config.base ?? '/').toBe('/');
});

test('deploy workflow builds with withastro/action on push to main and by hand', () => {
  expect(workflow).toMatch(/push:\s*\n\s*branches: \[main\]/);
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toMatch(/uses: withastro\/action@v\d+/);
  expect(workflow).toMatch(/uses: actions\/deploy-pages@v\d+/);
  expect(workflow).toContain('pages: write');
  expect(workflow).toContain('id-token: write');
});
