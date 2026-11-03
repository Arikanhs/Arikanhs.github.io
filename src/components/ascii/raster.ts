// Image preparation and the Canvas 2D fallback renderer for AsciiImage.
// Both the WebGL (textmode.js) and the static renderer sample the same
// prepared image, so the two versions match.

export interface PreparedImage {
  /** The prepared pixels: downscaled and, optionally, contrast-stretched. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface StaticOptions {
  characters: string;
  /** Cell size in CSS pixels (cells are square, like textmode's default font). */
  cellSize: number;
  background: string;
  fontFamily: string;
}

/** Longest side of the prepared image; enough for a few hundred columns. */
const MAX_SIDE = 480;
const cache = new Map<string, Promise<PreparedImage>>();

/** Loads and prepares an image once per (url, normalize) pair. */
export function prepareImage(src: string, normalize: boolean): Promise<PreparedImage> {
  const key = `${normalize ? 'n' : 'r'}:${src}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = load(src, normalize);
    cache.set(key, entry);
    entry.catch(() => cache.delete(key));
  }
  return entry;
}

async function load(src: string, normalize: boolean): Promise<PreparedImage> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();

  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('AsciiImage: Canvas 2D is unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  if (normalize) stretchLevels(ctx, width, height);
  return { canvas, width, height };
}

/** Rec. 601 luma, the formula textmode.js's brightness conversion uses. */
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Auto-levels: stretches brightness so the 2nd-98th percentile spans the full
 * range, which makes the whole character ramp (and brighter colors) show up.
 */
function stretchLevels(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) histogram[Math.round(luma(px[i], px[i + 1], px[i + 2]))] += 1;

  const percentile = (p: number) => {
    const target = width * height * p;
    let seen = 0;
    for (let v = 0; v < 256; v += 1) {
      seen += histogram[v];
      if (seen >= target) return v;
    }
    return 255;
  };
  const lo = percentile(0.02);
  const hi = percentile(0.98);
  if (hi - lo < 16) return; // nearly flat: stretching would only add noise

  const gain = 255 / (hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = (px[i] - lo) * gain;
    px[i + 1] = (px[i + 1] - lo) * gain;
    px[i + 2] = (px[i + 2] - lo) * gain;
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * One RGBA pixel per grid cell: the prepared image cover-cropped to the grid's
 * aspect ratio, with the browser averaging each cell's pixels as it scales down.
 */
export function sampleCells(image: PreparedImage, cols: number, rows: number): Uint8ClampedArray {
  const target = cols / rows;
  const sourceAspect = image.width / image.height;
  const sw = sourceAspect > target ? image.height * target : image.width;
  const sh = sourceAspect > target ? image.height : image.width / target;
  const sampler = document.createElement('canvas');
  sampler.width = cols;
  sampler.height = rows;
  const ctx = sampler.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8ClampedArray(cols * rows * 4);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.canvas, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, 0, 0, cols, rows);
  return ctx.getImageData(0, 0, cols, rows).data;
}

const masks = new Map<string, Map<string, Uint8ClampedArray>>();

/**
 * Each glyph of the ramp rasterized once as an alpha mask of cellPx x cellPx.
 * Semibold at 1.25x the cell keeps glyph "ink" close to textmode's pixel font
 * (IBM Plex Mono advance is 0.6em and caps 0.7em, so glyphs still fit the cell).
 */
export function glyphMasks(chars: string[], cellPx: number, fontFamily: string) {
  const key = `${cellPx}|${fontFamily}|${chars.join('')}`;
  let set = masks.get(key);
  if (set) return set;
  set = new Map();
  const canvas = document.createElement('canvas');
  canvas.width = cellPx;
  canvas.height = cellPx;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.font = `600 ${cellPx * 1.25}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    for (const char of new Set(chars)) {
      ctx.clearRect(0, 0, cellPx, cellPx);
      ctx.fillText(char, cellPx / 2, cellPx / 2);
      const rgba = ctx.getImageData(0, 0, cellPx, cellPx).data;
      const alpha = new Uint8ClampedArray(cellPx * cellPx);
      for (let i = 0; i < alpha.length; i += 1) alpha[i] = rgba[i * 4 + 3];
      set.set(char, alpha);
    }
  }
  masks.set(key, set);
  return set;
}

/** Any CSS color as [r, g, b]. */
export function parseColor(color: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

/**
 * The fallback: cover-crops the prepared image to one pixel per cell, maps each
 * cell's brightness to a character and fills it with the cell's color. Glyphs
 * are pre-rasterized masks blended into one ImageData, so the cost is a single
 * pass over the pixels instead of thousands of fillText calls.
 */
export function drawStaticAscii(
  canvas: HTMLCanvasElement,
  image: PreparedImage,
  options: StaticOptions,
  width: number,
  height: number,
  dpr: number,
) {
  const chars = Array.from(options.characters);
  const W = Math.max(1, Math.round(width * dpr));
  const H = Math.max(1, Math.round(height * dpr));
  const cellPx = Math.max(2, Math.round(options.cellSize * dpr));
  const cols = Math.ceil(W / cellPx);
  const rows = Math.ceil(H / cellPx);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { cols, rows };

  const cells = sampleCells(image, cols, rows);
  const glyphs = glyphMasks(chars, cellPx, options.fontFamily);
  const [bgR, bgG, bgB] = parseColor(options.background);
  const out = ctx.createImageData(W, H);
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = bgR;
    px[i + 1] = bgG;
    px[i + 2] = bgB;
    px[i + 3] = 255;
  }

  // Centre the grid; the last row and column may be cut off by the box.
  const ox = Math.floor((W - cols * cellPx) / 2);
  const oy = Math.floor((H - rows * cellPx) / 2);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const c = (row * cols + col) * 4;
      const [r, g, b] = [cells[c], cells[c + 1], cells[c + 2]];
      // Same mapping as textmode.js: round(brightness * (n - 1)).
      const mask = glyphs.get(chars[Math.round((luma(r, g, b) / 255) * (chars.length - 1))]);
      if (!mask) continue;
      for (let my = 0; my < cellPx; my += 1) {
        const y = oy + row * cellPx + my;
        if (y < 0 || y >= H) continue;
        for (let mx = 0; mx < cellPx; mx += 1) {
          const a = mask[my * cellPx + mx];
          if (a === 0) continue;
          const x = ox + col * cellPx + mx;
          if (x < 0 || x >= W) continue;
          const i = (y * W + x) * 4;
          const t = a / 255;
          px[i] = bgR + (r - bgR) * t;
          px[i + 1] = bgG + (g - bgG) * t;
          px[i + 2] = bgB + (b - bgB) * t;
        }
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  return { cols, rows };
}
