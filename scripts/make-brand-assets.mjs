// Generates the favicon set and the social preview image in public/:
//   favicon.ico (32px PNG inside an ICO), apple-touch-icon.png (180px),
//   icon-192.png, icon-512.png (from public/favicon.svg) and og.png (1200x630).
// og.png is laid out on top of the built home page so it uses the site's own
// fonts and tokens. Run with `npm run assets` (builds first).
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { SITE } from '../src/lib/site.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = 4411;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--ignore-lock'], {
  cwd: ROOT,
  stdio: 'ignore',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('make-brand-assets: preview server did not start');
}

/** An .ico file holding one PNG image (valid since Windows Vista, read by all browsers). */
function icoFromPng(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size % 256, 6);
  header.writeUInt8(size % 256, 7);
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // color planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([header, png]);
}

const ogHtml = `
<style>
  body { margin: 0; }
  .og { position: relative; width: 1200px; height: 630px; box-sizing: border-box; padding: 64px 72px;
    background: radial-gradient(ellipse 70% 60% at 50% 0%, rgb(146 83 0 / 0.08), transparent 70%),
      radial-gradient(circle at 1px 1px, rgb(43 36 29 / 0.12) 1px, transparent 0) 0 0 / 22px 22px, #f5efe3;
    color: #2b241d; font-family: var(--font-plex-mono); overflow: hidden; }
  .term { border: 1px solid #d9cdb8; border-radius: 6px; background: #fbf8f1;
    box-shadow: 0 40px 90px -40px rgb(146 83 0 / 0.3); }
  .bar { display: flex; justify-content: space-between; padding: 14px 22px; border-bottom: 1px solid #d9cdb8;
    background: #ede5d6; color: #5e5449; font-size: 20px; }
  .screen { padding: 36px 40px 44px; }
  .line { margin: 0; font-size: 28px; } .ps1 { color: #925300; }
  .name { margin: 22px 0 0; font-size: 76px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; }
  .cur { display: inline-block; width: 0.5em; height: 0.8em; margin-left: 0.12em; vertical-align: -0.04em; background: #925300; }
  .intro { margin: 22px 0 0; max-width: 30em; font-family: var(--font-source-serif); font-size: 29px; line-height: 1.45; color: #5e5449; }
  .url { position: absolute; right: 72px; bottom: 34px; margin: 0; font-size: 22px; color: #925300; }
</style>
<div class="og">
  <div class="term">
    <div class="bar"><span>hasan@arikan: ~</span><span>zsh</span></div>
    <div class="screen">
      <p class="line"><span class="ps1">~ $</span> whoami</p>
      <p class="name">${SITE.name}<span class="cur"></span></p>
      <p class="intro">${SITE.intro}</p>
    </div>
  </div>
  <p class="url">${new URL(SITE.url).host}</p>
</div>`;

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const svg = await readFile(path.join(PUBLIC, 'favicon.svg'), 'utf8');
    const icon = async (size, padding = 0, background = 'transparent') => {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<body style="margin:0;background:${background}"><div style="box-sizing:border-box;width:${size}px;height:${size}px;padding:${padding}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`,
      );
      return page.screenshot({ omitBackground: background === 'transparent' });
    };
    await writeFile(path.join(PUBLIC, 'favicon.ico'), icoFromPng(await icon(32), 32));
    await writeFile(path.join(PUBLIC, 'apple-touch-icon.png'), await icon(180, 20, '#f5efe3'));
    await writeFile(path.join(PUBLIC, 'icon-192.png'), await icon(192));
    await writeFile(path.join(PUBLIC, 'icon-512.png'), await icon(512));

    // Social image: reuse the built page's fonts by drawing over it.
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate((html) => {
      document.body.innerHTML = html;
      document.body.className = '';
    }, ogHtml);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(PUBLIC, 'og.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log('make-brand-assets: wrote favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, og.png');
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
