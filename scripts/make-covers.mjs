// Generates the sample project covers in src/assets/projects/ by drawing on a
// canvas in headless Chromium. Deterministic (seeded), so reruns give the same
// files. Replace the outputs with real images whenever you like.
//   node scripts/make-covers.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const OUT = path.resolve(import.meta.dirname, '../src/assets/projects');
const W = 1200;
const H = 800;

// Each function runs in the browser and draws on a W x H canvas context.
const covers = {
  // A runtime heatmap over (graph, CUDA block size) with a bright optimum, and a
  // small graph network drawn over it: the GCN that predicts the best setting.
  'gcn-cuda': (ctx, w, h, rand) => {
    const cols = 24;
    const rows = 16;
    const cw = w / cols;
    const ch = h / rows;
    const magma = ['#05030f', '#1d1147', '#51127c', '#822681', '#b63679', '#e65164', '#fb8861', '#fec287', '#fcfdbf'];
    const color = (t) => {
      const x = Math.max(0, Math.min(0.999, t)) * (magma.length - 1);
      return magma[Math.floor(x)];
    };
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const optimum = Math.exp(-(((c - 15) / 6) ** 2) - ((r - 6) / 5) ** 2);
        const ridge = 0.25 * Math.sin(c / 3 + r / 5) + 0.25;
        ctx.fillStyle = color(0.25 + optimum * 0.8 + ridge * 0.25 + (rand() - 0.5) * 0.12);
        ctx.fillRect(c * cw, r * ch, cw - 2, ch - 2);
      }
    }
    const nodes = Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2;
      const radius = 150 + rand() * 110;
      return { x: w * 0.3 + Math.cos(angle) * radius, y: h * 0.52 + Math.sin(angle) * radius * 0.8 };
    });
    ctx.strokeStyle = 'rgba(236,230,220,0.85)';
    ctx.lineWidth = 6;
    for (let i = 0; i < nodes.length; i += 1) {
      for (const j of [i + 1, i + 4]) {
        const a = nodes[i];
        const b = nodes[j % nodes.length];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb000';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // A lit low-poly mesh: graphs as triangles, for triangle counting on Kokkos.
  'kokkos-graphs': (ctx, w, h, rand) => {
    const step = 100;
    const pts = [];
    for (let y = -step; y <= h + step; y += step) {
      const row = [];
      for (let x = -step; x <= w + step; x += step) {
        row.push({ x: x + (rand() - 0.5) * step * 0.8, y: y + (rand() - 0.5) * step * 0.8 });
      }
      pts.push(row);
    }
    const light = { x: w * 0.55, y: h * 0.2 };
    const stops = [
      [24, 90, 160],
      [150, 60, 140],
      [255, 176, 0],
    ];
    const ramp = (t) => {
      const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(x));
      const f = x - i;
      return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * f);
    };
    const shade = (tri) => {
      const cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
      const cy = (tri[0].y + tri[1].y + tri[2].y) / 3;
      const d = Math.hypot(cx - light.x, cy - light.y) / Math.hypot(w, h);
      const k = Math.max(0.35, 1.1 - d * 1.2) * (0.8 + rand() * 0.3);
      const [r, g, b] = ramp(cx / w + (cy / h - 0.5) * 0.25).map((v) => Math.min(255, v * k));
      return `rgb(${r | 0},${g | 0},${b | 0})`;
    };
    for (let r = 0; r < pts.length - 1; r += 1) {
      for (let c = 0; c < pts[r].length - 1; c += 1) {
        const a = pts[r][c];
        const b = pts[r][c + 1];
        const d = pts[r + 1][c];
        const e = pts[r + 1][c + 1];
        for (const tri of [
          [a, b, e],
          [a, e, d],
        ]) {
          ctx.fillStyle = shade(tri);
          ctx.beginPath();
          ctx.moveTo(tri[0].x, tri[0].y);
          ctx.lineTo(tri[1].x, tri[1].y);
          ctx.lineTo(tri[2].x, tri[2].y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(13,12,11,0.55)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  },
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, draw] of Object.entries(covers)) {
  const dataUrl = await page.evaluate(
    ({ source, w, h, seed }) => {
      // mulberry32: small seeded PRNG so the output is reproducible.
      let s = seed;
      const rand = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      new Function('return ' + source)()(ctx, w, h, rand);
      return canvas.toDataURL('image/jpeg', 0.88);
    },
    { source: draw.toString(), w: W, h: H, seed: name.length * 7919 },
  );
  const file = path.join(OUT, `${name}.jpg`);
  await writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
await browser.close();
