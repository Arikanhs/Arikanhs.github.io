import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { builtHtml, builtPages, DIST } from './utils/site';

const ATTR = /\s(?:href|src|srcset|poster)="([^"]*)"/g;

function urlsIn(html: string): string[] {
  const urls: string[] = [];
  for (const [whole, value] of html.matchAll(ATTR)) {
    if (whole.trimStart().startsWith('srcset')) {
      urls.push(...value.split(',').map((part) => part.trim().split(/\s+/)[0]));
    } else {
      urls.push(value);
    }
  }
  return urls.filter(Boolean);
}

function hasId(html: string, id: string): boolean {
  return new RegExp(`\\sid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html);
}

// Checks every internal href/src in the build against the files in dist/.
// Page links must end in "/" (GitHub Pages would otherwise redirect), and
// "#fragment" links must point at an element that exists.
test('internal links and assets resolve', () => {
  const problems: string[] = [];
  for (const route of builtPages()) {
    const html = builtHtml(route);
    for (const raw of urlsIn(html)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue; // external, mailto:, data: ...
      const url = new URL(raw, `http://site${route}`);
      const target = decodeURIComponent(url.pathname);
      const fragment = decodeURIComponent(url.hash.slice(1));

      let targetHtml: string | undefined;
      if (target.endsWith('/')) {
        const file = path.join(DIST, target, 'index.html');
        if (!fs.existsSync(file)) {
          problems.push(`${route}: broken link ${raw}`);
          continue;
        }
        targetHtml = fs.readFileSync(file, 'utf8');
      } else if (fs.existsSync(path.join(DIST, target)) && fs.statSync(path.join(DIST, target)).isFile()) {
        if (target.endsWith('.html')) targetHtml = fs.readFileSync(path.join(DIST, target), 'utf8');
      } else if (fs.existsSync(path.join(DIST, target, 'index.html'))) {
        problems.push(`${route}: link without trailing slash ${raw}`);
        continue;
      } else {
        problems.push(`${route}: broken link ${raw}`);
        continue;
      }
      if (fragment && targetHtml && !hasId(targetHtml, fragment)) {
        problems.push(`${route}: missing #${fragment} for ${raw}`);
      }
    }
  }
  expect(problems).toEqual([]);
});
