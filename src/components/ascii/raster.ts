// Image preparation and the Canvas 2D fallback renderer for AsciiImage.
// Both the WebGL (textmode.js) and the static renderer sample the same
// prepared image, so the two versions match.

export interface PreparedImage {
  /** The prepared pixels: downscaled and, optionally, contrast-stretched. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Object URL of the prepared pixels, for textmode.js's loadImage(). */
  url: string;
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

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('AsciiImage: could not encode image'))), 'image/png'),
  );
  return { canvas, width, height, url: URL.createObjectURL(blob) };
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

/** Grid size for a box, shared by both renderers. */
export function gridFor(width: number, height: number, cellSize: number) {
  return { cols: Math.max(1, Math.ceil(width / cellSize)), rows: Math.max(1, Math.ceil(height / cellSize)) };
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

/**
 * The fallback: cover-crops the prepared image to one pixel per cell, maps each
 * cell's brightness to a character and fills it with the cell's color.
 */
export function drawStaticAscii(
  canvas: HTMLCanvasElement,
  image: PreparedImage,
  options: StaticOptions,
  width: number,
  height: number,
  dpr: number,
) {
  const { cellSize, background, fontFamily } = options;
  const chars = Array.from(options.characters);
  const { cols, rows } = gridFor(width, height, cellSize);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { cols, rows };
  const cells = sampleCells(image, cols, rows);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  // Semibold at 1.25x the cell keeps glyph "ink" close to textmode's pixel font
  // (IBM Plex Mono advance is 0.6em and caps 0.7em, so glyphs still fit the cell).
  ctx.font = `600 ${cellSize * 1.25}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Centre the grid; the last row and column may be cut off by the box.
  const x0 = (width - cols * cellSize) / 2 + cellSize / 2;
  const y0 = (height - rows * cellSize) / 2 + cellSize / 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = (row * cols + col) * 4;
      // Same mapping as textmode.js: round(brightness * (n - 1)).
      const char = chars[Math.round((luma(cells[i], cells[i + 1], cells[i + 2]) / 255) * (chars.length - 1))];
      if (char === ' ') continue;
      ctx.fillStyle = `rgb(${cells[i]} ${cells[i + 1]} ${cells[i + 2]})`;
      ctx.fillText(char, x0 + col * cellSize, y0 + row * cellSize);
    }
  }
  return { cols, rows };
}
