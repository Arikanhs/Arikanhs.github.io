// Generates public/cv.pdf by printing the built /resume/ page in Chromium, so
// the PDF always matches the site (and never contains anything the page does
// not). Run with `npm run cv`, which builds first and again afterwards so the
// new PDF is in dist/ too.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 4410;
const URL = `http://127.0.0.1:${PORT}/resume/`;
const OUT = path.join(ROOT, 'public/cv.pdf');

const server = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--ignore-lock'], {
  cwd: ROOT,
  stdio: 'ignore',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`export-cv: ${URL} did not start`);
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // US Letter; the print stylesheet also fits A4 (see tests/e2e/resume.spec.ts).
    await page.pdf({
      path: OUT,
      format: 'Letter',
      margin: { top: '14mm', bottom: '14mm', left: '15mm', right: '15mm' },
      printBackground: true,
      tagged: true,
      outline: true,
    });
    console.log(`export-cv: wrote ${path.relative(ROOT, OUT)}`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
