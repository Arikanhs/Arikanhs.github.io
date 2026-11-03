// Home page background: ASCII letters fly in from both sides and form a
// silhouette (shapes.ts) with its caption underneath, hold it for HOLD_MS while it acts (acts.ts: the bird
// bobs, the detective tips the hat, ...), scatter (the bird flies off instead),
// and gather into the next one, cycling through SHAPES. Rendered with textmode.js on a transparent
// canvas, so letters move from cell to cell like text on a terminal.
// Reduced motion or no hardware WebGL2: the first shape is drawn once with
// Canvas 2D. Off screen, in a hidden tab or when paused, nothing is drawn.
// Hovering with a mouse sends ripples through the letters around the cursor.
import type { Textmodifier } from 'textmode.js';
import { ACTS, type Cover, type Pose } from './acts';
import { FONT_HEIGHT, FONT_WIDTH, PIXEL_FONT } from './pixel-font';
import { glyphMasks, parseColor } from './raster';
import { SHAPES, type Shape } from './shapes';
import { cssToken, hasWebGL2, monoFont, resizeTextmodeCanvas } from './webgl';

type Color = [r: number, g: number, b: number, a: number];
type Phase = 'enter' | 'hold' | 'scatter' | 'gather';

/** Cell grid in CSS pixels, relative to the stage. */
interface Grid {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  offX: number;
  offY: number;
}

/** One cell of a formed shape: its centre (CSS px), how deep in the shape it is (0 to 1) and how it is drawn. */
interface Cell {
  x: number;
  y: number;
  density: number;
  char: string;
  color: Color;
  /** A letter of the caption: acts leave it alone (it scatters when the bird flies off). */
  text?: boolean;
}

interface Formed {
  cells: Cell[];
  cx: number;
  cy: number;
  /** The shape's 256 x 256 box on the stage (CSS px), where acts place letters. */
  left: number;
  top: number;
  size: number;
  /** A mid-density tone of the shape, for letters an act adds. */
  mid: Color;
  /** The shape's edge color, which an act's ink (pose.ink) blends from. */
  faint: [number, number, number];
}

/** Draws one letter in a grid cell; off the grid, nothing. */
type Put = (col: number, row: number, char: string, r: number, g: number, b: number, a: number) => void;

/** A letter. It moves from (sx, sy) to (ex, ey) along a bowed path. */
interface Particle {
  x: number;
  y: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  /** Sideways bow of the path at its middle, CSS px (signed). */
  curl: number;
  delay: number;
  dur: number;
  cell: Cell;
  /** Extra letters (a shape with fewer cells than letters) hide once they land. */
  spare: boolean;
  moving: boolean;
  /** A caption letter in a scatter: it breaks off and drifts a short way, eased in and out. */
  drift: boolean;
  seed: number;
}

/** Font size of a cell, CSS px, by stage width. */
const cellSize = (width: number) => (width < 640 ? 9 : 12);
const MAX_DPR = 2;
const HOLD_MS = 5000;
/** The scatter lasts this long; then the letters gather into the next shape. */
const SCATTER_MS = 1500;
/**
 * While a shape holds, how many letters in 1000 flicker at a time: more in the
 * captions, which have far fewer letters, so they flicker about as visibly.
 */
const TWINKLE = 8;
const CAPTION_TWINKLE = 50;
/** Longest frame step the clock takes, so a stalled tab does not skip ahead. */
const MAX_STEP = 100;
/** Light to dense; a cell's density picks its character. */
const RAMP = '.:-=+*#%@';
/** Shown while a letter is in flight. */
const FLIGHT = '#%@*+=-:<>/\\|{}[]01';
/**
 * Hover ripple: waves run outward from the mouse through the letters within
 * RIPPLE_RADIUS (CSS px). Crests push letters out, make them denser and light
 * them in the hover accent; troughs pull them in and thin them out.
 */
const RIPPLE_RADIUS = 170;
const RIPPLE_WAVELENGTH = 42;
/** One wave passes every RIPPLE_PERIOD ms. */
const RIPPLE_PERIOD = 700;
/** Push at the cursor, CSS px (a cell is 9 to 12). */
const RIPPLE_PUSH = 14;
/** The ripple fades in and out over about this long, ms. */
const RIPPLE_FADE = 250;

const easeInCubic = (t: number) => t ** 3;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const PAUSED_KEY = 'hero-ascii-paused';

function storedPaused() {
  try {
    return localStorage.getItem(PAUSED_KEY) === '1';
  } catch {
    return false;
  }
}

function storePaused(paused: boolean) {
  try {
    if (paused) localStorage.setItem(PAUSED_KEY, '1');
    else localStorage.removeItem(PAUSED_KEY);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Where the shape goes, given the box of the element it should stay clear of
 * (the terminal). The page's CSS leaves room either to the right of it (wide
 * screens) or below it (narrow ones); the shape fills whichever is larger.
 * Without such an element (the /lab/home test page) the shape is centred.
 */
interface Area {
  kind: 'centre' | 'right' | 'below';
  left: number;
  top: number;
  width: number;
  height: number;
}

function shapeArea(width: number, height: number, avoid?: { right: number; bottom: number }): Area {
  if (!avoid) return { kind: 'centre', left: 0, top: 0, width, height };
  const rightW = width - avoid.right;
  const belowH = height - avoid.bottom;
  if (rightW >= belowH) return { kind: 'right', left: avoid.right, top: 0, width: rightW, height };
  return { kind: 'below', left: 0, top: avoid.bottom, width, height: belowH };
}

/** The shape's box in its area, leaving `reserve` px at the bottom for the caption. */
function shapeBox(area: Area, reserve: number) {
  // The icons leave about a tenth of their 256 box empty around the drawing, so
  // a box the full height of the area still keeps the shape off its edges.
  const margin = 8;
  const height = area.height - reserve;
  const size =
    area.kind === 'centre'
      ? Math.min(area.width * 0.9, height, 900)
      : area.kind === 'right'
        ? Math.min(area.width - 2 * margin, height * 0.98, 760)
        : Math.min(height - 2 * margin, area.width * 0.95, 560);
  return { cx: area.left + area.width / 2, cy: area.top + height / 2, size };
}

/** How the captions are set: in big pixel letters, or one letter per cell. */
interface Captions {
  big: boolean;
  /** Each shape's caption, in lines. */
  lines: string[][];
  /** The tallest caption, in rows of cells. */
  rows: number;
}

/** Rows a caption takes: pixel letters are FONT_HEIGHT tall with two blank rows between lines. */
const captionRows = (lines: number, big: boolean) => (big ? lines * (FONT_HEIGHT + 2) - 2 : lines);

/**
 * Big pixel letters (a cell per dot) when every caption fits the area in at most
 * three lines and the tallest takes at most 30% of its height; otherwise one
 * letter per cell, wrapped to at most 48 a line. In capitals either way (the
 * pixel font has only capitals, and the animation's own font draws a
 * lowercase g much like a 9).
 */
function setCaptions(texts: string[], area: Area, grid: Grid): Captions {
  const cols = Math.floor((area.width - 32) / grid.cellW);
  const upper = texts.map((text) => text.toUpperCase());
  const perLine = Math.floor((cols + 1) / (FONT_WIDTH + 1));
  const big = upper.map((text) => wrap(text, perLine));
  const bigRows = captionRows(Math.max(...big.map((lines) => lines.length)), true);
  const fits = big.every((lines) => lines.length <= 3 && lines.every((line) => line.length <= perLine));
  if (fits && bigRows * grid.cellH <= area.height * 0.3) return { big: true, lines: big, rows: bigRows };
  const plain = upper.map((text) => wrap(text, Math.max(12, Math.min(48, cols))));
  return { big: false, lines: plain, rows: captionRows(Math.max(...plain.map((lines) => lines.length)), false) };
}

/** Splits a caption into lines of at most `cols` characters, between words. */
function wrap(text: string, cols: number) {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= cols) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

/**
 * Rasterizes a shape onto the grid and picks each covered cell's character and
 * color, then sets its caption (already wrapped) in the color of the shape's
 * densest letters, halfway between the bottom of the drawing and `floor` (the
 * area's bottom).
 */
function formShape(
  shape: Shape,
  grid: Grid,
  box: { cx: number; cy: number; size: number },
  caption: string[],
  big: boolean,
  floor: number,
): Formed {
  // Edges in the faint ink, the middle in the shape's ink (theme tokens).
  const faint = parseColor(cssToken('--color-faint') || '#6f6458');
  const accent = parseColor(cssToken(shape.ink ?? '--color-accent') || '#925300');
  const SS = 3; // samples per cell side
  const { cols, rows, cellW, cellH, offX, offY } = grid;
  const canvas = document.createElement('canvas');
  canvas.width = cols * SS;
  canvas.height = rows * SS;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tone = (density: number): Color => {
    const mix = density ** 1.5;
    return [
      Math.round(faint[0] + (accent[0] - faint[0]) * mix),
      Math.round(faint[1] + (accent[1] - faint[1]) * mix),
      Math.round(faint[2] + (accent[2] - faint[2]) * mix),
      Math.round(255 * (0.45 + 0.5 * density)),
    ];
  };
  const placed = {
    cx: box.cx,
    cy: box.cy,
    left: box.cx - box.size / 2,
    top: box.cy - box.size / 2,
    size: box.size,
    mid: tone(0.6),
    faint,
  };
  if (!ctx) return { cells: [], ...placed };
  ctx.setTransform(SS / cellW, 0, 0, SS / cellH, (-offX * SS) / cellW, (-offY * SS) / cellH);
  ctx.translate(box.cx - box.size / 2, box.cy - box.size / 2);
  ctx.scale(box.size / 256, box.size / 256);
  ctx.fill(new Path2D(shape.path));
  const alpha = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const coverage = new Float32Array(cols * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let sum = 0;
      for (let y = 0; y < SS; y += 1) {
        const base = ((row * SS + y) * canvas.width + col * SS) * 4 + 3;
        for (let x = 0; x < SS; x += 1) sum += alpha[base + x * 4];
      }
      coverage[row * cols + col] = sum / (SS * SS * 255);
    }
  }

  // Distance of each inside cell from the edge (two-pass chamfer, in px), so
  // edges get light characters and the middle dense ones, like a dome.
  const inside = (i: number) => coverage[i] >= 0.45;
  const diagonal = Math.hypot(cellW, cellH);
  const dist = new Float32Array(cols * rows);
  for (let i = 0; i < dist.length; i += 1) dist[i] = inside(i) ? Infinity : 0;
  const relax = (i: number, col: number, row: number, dc: number, dr: number, step: number) => {
    const c = col + dc;
    const r = row + dr;
    const d = c < 0 || r < 0 || c >= cols || r >= rows ? 0 : dist[r * cols + c];
    if (d + step < dist[i]) dist[i] = d + step;
  };
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      if (!inside(i)) continue;
      relax(i, col, row, -1, 0, cellW);
      relax(i, col, row, 0, -1, cellH);
      relax(i, col, row, -1, -1, diagonal);
      relax(i, col, row, 1, -1, diagonal);
    }
  }
  let deepest = 0;
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      const i = row * cols + col;
      if (!inside(i)) continue;
      relax(i, col, row, 1, 0, cellW);
      relax(i, col, row, 0, 1, cellH);
      relax(i, col, row, 1, 1, diagonal);
      relax(i, col, row, -1, 1, diagonal);
      deepest = Math.max(deepest, dist[i]);
    }
  }

  // Light falls from the top left.
  const cells: Cell[] = [];
  const left = box.cx - box.size / 2;
  const top = box.cy - box.size / 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const i = row * cols + col;
      if (!inside(i)) continue;
      const x = offX + (col + 0.5) * cellW;
      const y = offY + (row + 0.5) * cellH;
      const u = (x - left) / box.size;
      const v = (y - top) / box.size;
      const light = 0.6 + 0.4 * (1 - (u + v) / 2);
      const depth = Math.sqrt(dist[i] / (deepest || 1));
      const density = Math.min(1, (0.2 + 0.8 * depth) * light);
      const index = Math.max(1, Math.round(density * (RAMP.length - 1)));
      cells.push({ x, y, density, char: RAMP[index], color: tone(density) });
    }
  }

  // The caption, centred across and halfway down the space below the drawing.
  const bottom = cells.reduce((low, cell) => Math.max(low, cell.y), box.cy);
  const below = Math.floor((bottom - offY) / cellH) + 1;
  const last = Math.floor((floor - offY) / cellH);
  const firstRow = Math.round((below + last) / 2 - captionRows(caption.length, big) / 2);
  // In the color of the shape's densest letters (the bird's light middle, its wing).
  const densest = cells.reduce<Cell | undefined>((best, cell) => (best && best.density >= cell.density ? best : cell), undefined);
  const ink = densest?.density ?? 0.85;
  const color = densest?.color ?? tone(ink);
  const letter = (col: number, row: number, char: string) =>
    cells.push({ x: offX + (col + 0.5) * cellW, y: offY + (row + 0.5) * cellH, density: ink, char, color, text: true });
  caption.forEach((line, i) => {
    const chars = Array.from(line);
    if (!big) {
      const firstCol = Math.round((box.cx - offX) / cellW - chars.length / 2);
      chars.forEach((char, j) => char !== ' ' && letter(firstCol + j, firstRow + i, char));
      return;
    }
    // Pixel letters: every dot is a dense letter, like the shape's middle.
    const firstCol = Math.round((box.cx - offX) / cellW - (chars.length * (FONT_WIDTH + 1) - 1) / 2);
    const top = firstRow + i * (FONT_HEIGHT + 2);
    const dot = '#';
    chars.forEach((char, j) => {
      (PIXEL_FONT[char] ?? []).forEach((dots, y) => {
        Array.from(dots).forEach((on, x) => on === '#' && letter(firstCol + j * (FONT_WIDTH + 1) + x, top + y, dot));
      });
    });
  });
  return { cells, ...placed };
}

class HeroBackground {
  private canvas: HTMLCanvasElement;
  private readonly toggle: HTMLButtonElement | null;
  private readonly resizeObserver: ResizeObserver;
  private readonly screenObserver: IntersectionObserver;
  private tm?: Textmodifier;
  private grid?: Grid;
  private formed: Formed[] = [];
  /** The ripple crests' color (the hover accent, lighter than the shapes). */
  private accent: [number, number, number] = [0, 0, 0];
  private readonly inks = new Map<string, [number, number, number]>();
  private particles: Particle[] = [];
  private shapeIndex = 0;
  private phase: Phase = 'enter';
  private phaseStart = 0;
  private phaseLength = 0;
  private clock = 0;
  private last = 0;
  private onScreen = true;
  private paused = storedPaused();
  private destroyed = false;
  private frame = 0;
  private fps = 0;
  /** The mouse in client coordinates, while it is over the window. */
  private pointer?: { x: number; y: number };
  /** Ripple strength (0 to 1, eased) and its centre, relative to the stage. */
  private ripple = 0;
  private rippleX = 0;
  private rippleY = 0;
  private cancelStart: () => void;

  constructor(readonly stage: HTMLElement) {
    this.canvas = stage.querySelector('canvas') ?? stage.appendChild(document.createElement('canvas'));
    this.toggle = stage.parentElement?.querySelector<HTMLButtonElement>('[data-hero-ascii-toggle]') ?? null;
    this.toggle?.addEventListener('click', this.onToggle);
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.screenObserver = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      this.updateLoop();
    });
    reducedMotion.addEventListener('change', this.onMotionChange);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('pointerout', this.onPointerOut);
    // Start once the page is idle, so it never competes with the first paint.
    const start = () => {
      if (this.destroyed) return;
      this.resizeObserver.observe(stage);
      this.screenObserver.observe(stage);
      void this.start();
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(start, { timeout: 1200 });
      this.cancelStart = () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(start, 300);
      this.cancelStart = () => clearTimeout(id);
    }
  }

  private get wantsLive() {
    return !reducedMotion.matches && hasWebGL2();
  }

  private setState(state: 'static' | 'live') {
    this.stage.dataset.heroAscii = state;
    if (this.toggle) this.toggle.hidden = state !== 'live';
  }

  private async start() {
    if (!this.wantsLive) {
      await document.fonts.load(`${cellSize(this.size().width)}px ${monoFont()}`);
      if (!this.destroyed) this.drawStatic();
      return;
    }
    try {
      await this.createLive();
    } catch (error) {
      console.warn('Hero background: WebGL rendering failed; showing the static version.', error);
      this.releaseLive();
      this.drawStatic();
    }
  }

  private size() {
    const rect = this.stage.getBoundingClientRect();
    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      dpr: Math.min(MAX_DPR, window.devicePixelRatio || 1),
    };
  }

  /** Right and bottom edges of the element the shape stays clear of, relative to the stage. */
  private avoidBox() {
    const selector = this.stage.dataset.avoid;
    const avoid = selector ? document.querySelector(selector) : null;
    if (!avoid) return undefined;
    const stage = this.stage.getBoundingClientRect();
    const rect = avoid.getBoundingClientRect();
    return { right: rect.right - stage.left, bottom: rect.bottom - stage.top };
  }

  private layout(grid: Grid) {
    const { width, height } = this.size();
    const area = shapeArea(width, height, this.avoidBox());
    // The box leaves room below the shape for the tallest caption and a little
    // space around it; each caption then sits halfway between its shape and the
    // bottom of the area.
    const captions = setCaptions(
      SHAPES.map((shape) => shape.caption),
      area,
      grid,
    );
    const box = shapeBox(area, (captions.rows + 4) * grid.cellH);
    const floor = area.top + area.height;
    this.grid = grid;
    this.formed = SHAPES.map((shape, i) => formShape(shape, grid, box, captions.lines[i], captions.big, floor));
    // For tests: the shapes' 256 x 256 box on the stage (CSS px).
    this.stage.dataset.box = [box.cx - box.size / 2, box.cy - box.size / 2, box.size].map(Math.round).join(',');
    this.accent = parseColor(cssToken('--color-accent-strong') || '#7a4500');
    this.inks.clear();
  }

  // ---- Canvas 2D: the first shape, drawn once (and again on resize) ----

  /** Square cells like textmode's; each glyph is rasterized once and composed in one pass. */
  private drawStatic() {
    this.releaseLive();
    const { width, height, dpr } = this.size();
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const W = (this.canvas.width = Math.round(width * dpr));
    const H = (this.canvas.height = Math.round(height * dpr));
    const cellPx = Math.round(cellSize(width) * dpr);
    const cols = Math.floor(W / cellPx);
    const rows = Math.floor(H / cellPx);
    const offX = Math.floor((W - cols * cellPx) / 2);
    const offY = Math.floor((H - rows * cellPx) / 2);
    this.layout({ cols, rows, cellW: cellPx / dpr, cellH: cellPx / dpr, offX: offX / dpr, offY: offY / dpr });

    const chars = new Set([...RAMP, ...(this.formed[0]?.cells.map((cell) => cell.char) ?? [])]);
    const masks = glyphMasks([...chars], cellPx, monoFont());
    const out = ctx.createImageData(W, H);
    const px = out.data;
    for (const cell of this.formed[0]?.cells ?? []) {
      const mask = masks.get(cell.char);
      if (!mask) continue;
      const [r, g, b, a] = cell.color;
      const x0 = Math.round(cell.x * dpr - cellPx / 2);
      const y0 = Math.round(cell.y * dpr - cellPx / 2);
      for (let my = 0; my < cellPx; my += 1) {
        const y = y0 + my;
        if (y < 0 || y >= H) continue;
        for (let mx = 0; mx < cellPx; mx += 1) {
          const alpha = mask[my * cellPx + mx];
          const x = x0 + mx;
          if (alpha === 0 || x < 0 || x >= W) continue;
          const i = (y * W + x) * 4;
          px[i] = r;
          px[i + 1] = g;
          px[i + 2] = b;
          px[i + 3] = (alpha * a) / 255;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    this.setState('static');
  }

  // ---- textmode.js: the animation ----

  private async createLive() {
    const { textmode } = await import('textmode.js');
    if (this.destroyed || this.tm || !this.wantsLive) return;
    const { width, height, dpr } = this.size();
    // A canvas that had a 2D context cannot get a WebGL one: start fresh.
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    this.canvas.replaceWith(canvas);
    this.canvas = canvas;

    const tm = textmode.create({ canvas, fontSize: cellSize(width) * dpr, loadingScreen: { transition: 'none' } });
    this.tm = tm;
    tm.loading.draw(({ textmodifier }) => textmodifier.clear());
    tm.draw(() => this.tick());
    // setup() only registers the callback; it runs once the renderer is ready.
    await new Promise<void>((resolve, reject) => {
      void tm.setup(() => {
        try {
          this.syncGrid();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    if (this.tm !== tm) return;
    this.setState('live');
    this.enter();
    this.renderToggle();
    this.updateLoop();
    // Paused: show the finished shape. The loop is stopped first, so the frame
    // settle() asks for is not dropped with it.
    if (this.paused) this.settle();
  }

  /** Reads textmode's grid (device px) and re-forms the shapes on it. */
  private syncGrid() {
    const tm = this.tm;
    const grid = tm?.grid;
    if (!grid) return;
    const { dpr } = this.size();
    this.layout({
      cols: grid.cols,
      rows: grid.rows,
      cellW: grid.cellWidth / dpr,
      cellH: grid.cellHeight / dpr,
      offX: grid.offsetX / dpr,
      offY: grid.offsetY / dpr,
    });
    this.stage.dataset.grid = `${grid.cols}x${grid.rows}`;
  }

  /** Gives every cell of the shape at least one letter; extra letters double up. */
  private assign(formed: Formed) {
    const needed = Math.max(...this.formed.map((f) => f.cells.length));
    while (this.particles.length < needed) {
      this.particles.push({
        x: -100,
        y: -100,
        sx: 0,
        sy: 0,
        ex: 0,
        ey: 0,
        curl: 0,
        delay: 0,
        dur: 1,
        cell: formed.cells[0],
        spare: true,
        moving: true,
        drift: false,
        seed: Math.floor(Math.random() * 1e6),
      });
    }
    const order = shuffle(formed.cells.map((_, i) => i));
    shuffle(this.particles).forEach((particle, i) => {
      const spare = i >= order.length;
      particle.cell = formed.cells[spare ? Math.floor(Math.random() * order.length) : order[i]];
      particle.spare = spare;
    });
  }

  private beginPhase(phase: Phase, length: number) {
    this.phase = phase;
    this.phaseStart = this.clock;
    this.phaseLength = length;
    this.stage.dataset.phase = phase;
    this.stage.dataset.shape = SHAPES[this.shapeIndex].name;
    this.syncFrameRate();
  }

  /** The current shape's acts; none on the lab page's still mode (data-acts="off"). */
  private get acts() {
    return this.stage.dataset.acts === 'off' ? undefined : ACTS[SHAPES[this.shapeIndex].name];
  }

  /** The bird's exit: all its letters fly off together instead of scattering. */
  private get flyingOff() {
    return this.phase === 'scatter' && Boolean(this.acts?.flyOff);
  }

  /** What the shape does right now: while it holds, or while it flies off. */
  private get scene() {
    if (this.phase === 'hold') return this.acts?.hold;
    return this.flyingOff ? this.acts?.flyOff : undefined;
  }

  /** While a shape holds: 30 fps if it acts, 12 if it is still. 60 while letters fly or ripple. */
  private syncFrameRate() {
    const tm = this.tm;
    const holding = this.phase === 'hold' && this.ripple === 0;
    const acting = Boolean(this.acts?.hold);
    const fps = holding ? (acting ? 30 : 12) : 60;
    if (!tm || fps === this.fps) return;
    this.fps = fps;
    tm.frameRate(fps);
  }

  /** Letters stream in from the left and right edges into the current shape. */
  private enter() {
    const formed = this.formed[this.shapeIndex];
    if (!formed || formed.cells.length === 0) return;
    const { width, height } = this.size();
    this.assign(formed);
    let longest = 0;
    for (const p of this.particles) {
      const fromLeft = p.cell.x < formed.cx ? Math.random() > 0.15 : Math.random() < 0.15;
      p.sx = fromLeft ? -rand(20, 20 + width * 0.25) : width + rand(20, 20 + width * 0.25);
      p.sy = p.cell.y + rand(-0.25, 0.25) * height;
      p.x = p.sx;
      p.y = p.sy;
      p.ex = p.cell.x;
      p.ey = p.cell.y;
      p.curl = rand(-60, 60);
      p.delay = rand(0, 900);
      p.dur = rand(1500, 2300);
      longest = Math.max(longest, p.delay + p.dur);
    }
    this.beginPhase('enter', longest);
  }

  /**
   * Letters burst outward from the shape's centre; caption letters break off one
   * by one and drift a short way. A shape that flies off (the bird) goes up and
   * away to the top right, curving (forward first, then up), all its letters
   * together; its caption drifts apart as usual.
   */
  private scatter() {
    const formed = this.formed[this.shapeIndex];
    if (!formed) return;
    const { width, height } = this.size();
    const flies = Boolean(this.acts?.flyOff);
    const reach = Math.max(width, height);
    for (const p of this.particles) {
      p.drift = Boolean(p.cell.text);
      if (p.drift) {
        let angle = Math.atan2(p.y - formed.cy, p.x - formed.cx) + rand(-0.8, 0.8);
        if (!Number.isFinite(angle)) angle = rand(0, Math.PI * 2);
        const distance = reach * rand(0.04, 0.16);
        p.sx = p.x;
        p.sy = p.y;
        p.ex = p.x + Math.cos(angle) * distance;
        p.ey = p.y + Math.sin(angle) * distance;
        p.curl = rand(-30, 30);
        p.delay = rand(0, 500);
        p.dur = rand(850, 1000);
        continue;
      }
      if (flies) {
        p.sx = p.x;
        p.sy = p.y;
        p.ex = p.x + width * 0.8;
        p.ey = p.y - height * 1.2;
        p.curl = reach * 0.12;
        p.delay = 0;
        p.dur = SCATTER_MS;
        continue;
      }
      let angle = Math.atan2(p.y - formed.cy, p.x - formed.cx);
      if (!Number.isFinite(angle)) angle = rand(0, Math.PI * 2);
      angle += rand(-0.6, 0.6);
      const distance = reach * rand(0.12, 0.5);
      p.sx = p.x;
      p.sy = p.y;
      p.ex = p.x + Math.cos(angle) * distance;
      p.ey = p.y + Math.sin(angle) * distance;
      p.curl = rand(-60, 60);
      p.delay = rand(0, 250);
      p.dur = rand(900, 1250);
    }
    this.beginPhase('scatter', SCATTER_MS);
  }

  /** Letters swirl in from wherever they are to the current shape. */
  private gather() {
    const formed = this.formed[this.shapeIndex];
    if (!formed || formed.cells.length === 0) return;
    this.assign(formed);
    let longest = 0;
    for (const p of this.particles) {
      p.drift = false;
      p.sx = p.x;
      p.sy = p.y;
      p.ex = p.cell.x;
      p.ey = p.cell.y;
      p.curl = rand(-120, 120);
      p.delay = rand(0, 500);
      p.dur = rand(1500, 2100);
      longest = Math.max(longest, p.delay + p.dur);
    }
    this.beginPhase('gather', longest);
  }

  /** Puts every letter in place at once (paused before it formed, or resized while holding). */
  private settle() {
    for (const p of this.particles) {
      p.x = p.ex = p.cell.x;
      p.y = p.ey = p.cell.y;
      p.moving = false;
    }
    this.beginPhase('hold', HOLD_MS);
    this.tm?.redraw();
  }

  private move(ease: (t: number) => number) {
    const t = this.clock - this.phaseStart;
    for (const p of this.particles) {
      const local = Math.min(1, Math.max(0, (t - p.delay) / p.dur));
      const e = p.drift ? easeInOutCubic(local) : ease(local);
      const dx = p.ex - p.sx;
      const dy = p.ey - p.sy;
      const length = Math.hypot(dx, dy) || 1;
      const bow = Math.sin(Math.PI * e) * p.curl;
      p.x = p.sx + dx * e - (dy / length) * bow;
      p.y = p.sy + dy * e + (dx / length) * bow;
      p.moving = local < 1;
    }
  }

  /** One frame: advance the clock and the phase, then draw. */
  private tick() {
    const tm = this.tm;
    const grid = this.grid;
    if (!tm || !grid) return;
    const now = performance.now();
    const step = Math.min(MAX_STEP, this.last ? now - this.last : 0);
    if (!this.paused) this.clock += step;
    this.last = now;
    this.updateRipple(step);

    const t = this.clock - this.phaseStart;
    if (this.phase === 'hold') {
      if (t >= this.phaseLength) {
        this.scatter();
      }
    } else if (this.phase === 'scatter') {
      // Taking off speeds up; a burst slows down.
      this.move(this.flyingOff ? easeInCubic : easeOutCubic);
      if (t >= this.phaseLength) {
        this.shapeIndex = (this.shapeIndex + 1) % SHAPES.length;
        this.gather();
      }
    } else {
      this.move(this.phase === 'enter' ? easeOutCubic : easeInOutCubic);
      if (t >= this.phaseLength) {
        this.settle();
      }
    }
    this.draw(tm, grid);
  }

  /** A color token as RGB, read once per layout (acts' inks, like the detective's hats). */
  private ink(token: string) {
    let color = this.inks.get(token);
    if (!color) {
      color = parseColor(cssToken(token) || '#ffffff');
      this.inks.set(token, color);
    }
    return color;
  }

  /** Eases the ripple in while the mouse is over the stage, and out once it leaves. */
  private updateRipple(step: number) {
    let target = 0;
    if (this.pointer && !this.paused) {
      const rect = this.stage.getBoundingClientRect();
      const x = this.pointer.x - rect.left;
      const y = this.pointer.y - rect.top;
      if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
        target = 1;
        this.rippleX = x;
        this.rippleY = y;
      }
    }
    this.ripple += (target - this.ripple) * Math.min(1, step / RIPPLE_FADE);
    if (target === 0 && this.ripple < 0.02) this.ripple = 0;
    const state = this.ripple > 0 ? 'on' : 'off';
    if (this.stage.dataset.ripple !== state) this.stage.dataset.ripple = state;
    this.syncFrameRate();
  }

  /** How far a letter at (x, y) is lifted by the ripple: -1 (trough) to 1 (crest). */
  private rippleLift(x: number, y: number) {
    if (this.ripple === 0) return 0;
    const d = Math.hypot(x - this.rippleX, y - this.rippleY);
    if (d >= RIPPLE_RADIUS) return 0;
    const wave = Math.sin(2 * Math.PI * (d / RIPPLE_WAVELENGTH - this.clock / RIPPLE_PERIOD));
    const fade = 1 - d / RIPPLE_RADIUS;
    return this.ripple * fade * (2 - fade) * wave;
  }

  private draw(tm: Textmodifier, grid: Grid) {
    tm.clear();
    tm.cellColor(0, 0, 0, 0);
    // textmode's origin is the centre cell: column offset ceil(cols/2) - 1, row offset floor(rows/2).
    const colOffset = Math.ceil(grid.cols / 2) - 1;
    const rowOffset = Math.floor(grid.rows / 2);
    const put: Put = (col, row, char, r, g, b, a) => {
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return;
      tm.push();
      tm.translate(col - colOffset, row - rowOffset);
      tm.char(char);
      tm.charColor(r, g, b, a);
      tm.point();
      tm.pop();
    };
    const flicker = Math.floor(this.clock / 70);
    const twinkle = Math.floor(this.clock / 120);
    // The shape's scene: its act poses each letter from its place in the shape's box.
    const flyingOff = this.flyingOff;
    const scene = this.scene;
    const act = scene?.pose;
    const formed = this.formed[this.shapeIndex];
    const unit = formed ? formed.size / 256 : 1;
    const t = this.clock - this.phaseStart;
    const pose: Pose = { dx: 0, dy: 0, glow: 0, ink: null, lifted: false, baseDx: 0, baseDy: 0 };
    // Lifted letters (the bird's wing) are drawn last, over the rest.
    const lifted: Parameters<Put>[] = [];
    for (const p of this.particles) {
      if (p.spare && !p.moving) continue;
      pose.dx = 0;
      pose.dy = 0;
      pose.glow = 0;
      pose.ink = null;
      pose.lifted = false;
      pose.baseDx = 0;
      pose.baseDy = 0;
      if (act && formed && !p.cell.text) {
        const u = (p.cell.x - formed.left) / unit;
        act(pose, u, (p.cell.y - formed.top) / unit, t, this.phaseLength, p.cell.density);
      }
      if (pose.lifted && formed) {
        // The shape stays whole under it: its mid tone fills the letter's place.
        const [r, g, b, a] = formed.mid;
        const baseCol = Math.floor((p.x + pose.baseDx * unit - grid.offX) / grid.cellW);
        const baseRow = Math.floor((p.y + pose.baseDy * unit - grid.offY) / grid.cellH);
        put(baseCol, baseRow, RAMP[5], r, g, b, a);
      }
      const px = p.x + pose.dx * unit;
      const py = p.y + pose.dy * unit;
      // The ripple pushes the letter along the line from the cursor.
      const lift = this.rippleLift(px, py);
      const away = Math.hypot(px - this.rippleX, py - this.rippleY) || 1;
      const x = px + ((px - this.rippleX) / away) * RIPPLE_PUSH * lift;
      const y = py + ((py - this.rippleY) / away) * RIPPLE_PUSH * lift;
      const col = Math.floor((x - grid.offX) / grid.cellW);
      const row = Math.floor((y - grid.offY) / grid.cellH);
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
      // In flight: a changing glyph (not the bird flying off, which stays a bird).
      // Holding: a few cells flicker.
      const inFlight = p.moving && (!flyingOff || p.drift);
      const rate = p.cell.text ? CAPTION_TWINKLE : TWINKLE;
      const twinkling = this.phase === 'hold' && (p.seed * 7919 + twinkle * 104729) % 1000 < rate;
      const scrambled = inFlight || twinkling;
      let char = scrambled ? FLIGHT[(p.seed + flicker) % FLIGHT.length] : p.cell.char;
      let [r, g, b, a] = p.cell.color;
      if (pose.ink && formed) {
        // The act's ink in place of the shape's: blended from the edge color by density
        // (reaching further out than formShape's, so the color fills the part), and
        // nearly opaque, so the page's blue does not wash it out.
        const ink = this.ink(pose.ink);
        const mix = p.cell.density ** 0.6;
        [r, g, b] = formed.faint.map((edge, i) => edge + (ink[i] - edge) * mix);
        a = Math.max(a, 235);
      }
      if (inFlight) a *= 0.75;
      // Ramp letters get denser or lighter (not a caption's own letters, on narrow screens).
      if ((lift !== 0 || pose.glow > 0) && !scrambled && RAMP.includes(char)) {
        const index = RAMP.indexOf(char) + Math.round(lift * 4 + pose.glow * 3);
        char = RAMP[Math.min(RAMP.length - 1, Math.max(0, index))];
      }
      // Ripple crests and the act's highlights glow in the hover accent.
      const glow = Math.min(1, Math.max(pose.glow, lift * 1.2));
      if (glow > 0) {
        r += (this.accent[0] - r) * glow;
        g += (this.accent[1] - g) * glow;
        b += (this.accent[2] - b) * glow;
        a += (255 - a) * glow;
      } else if (lift < 0) {
        a *= 1 + lift * 0.7;
      }
      if (pose.lifted) lifted.push([col, row, char, r, g, b, a]);
      else put(col, row, char, r, g, b, a);
    }
    for (const letter of lifted) put(...letter);
    if (scene?.cover && formed) {
      // Flying off, the shape's letters have all moved by the same amount; the cover goes along.
      const lead = this.particles.find((p) => !p.drift);
      const shift = flyingOff && lead ? { x: lead.x - lead.cell.x, y: lead.y - lead.cell.y } : { x: 0, y: 0 };
      this.drawCover(put, grid, formed, scene.cover, t, shift);
    }
  }

  /** Letters the act adds over the shape (the bird's eyelid, its wing in flight). */
  private drawCover(put: Put, grid: Grid, formed: Formed, cover: Cover, t: number, shift: { x: number; y: number }) {
    const unit = formed.size / 256;
    const left = formed.left + shift.x;
    const top = formed.top + shift.y;
    const cx = left + cover.u * unit;
    const cy = top + cover.v * unit;
    const radius = cover.r * unit;
    const col0 = Math.max(0, Math.floor((cx - radius - grid.offX) / grid.cellW));
    const col1 = Math.min(grid.cols - 1, Math.floor((cx + radius - grid.offX) / grid.cellW));
    const row0 = Math.max(0, Math.floor((cy - radius - grid.offY) / grid.cellH));
    const row1 = Math.min(grid.rows - 1, Math.floor((cy + radius - grid.offY) / grid.cellH));
    for (let row = row0; row <= row1; row += 1) {
      for (let col = col0; col <= col1; col += 1) {
        const x = grid.offX + (col + 0.5) * grid.cellW;
        const y = grid.offY + (row + 0.5) * grid.cellH;
        if (Math.hypot(x - cx, y - cy) > radius) continue;
        const glyph = cover.glyph((x - left) / unit, (y - top) / unit, t, grid.cellH / unit);
        if (!glyph) continue;
        const { char, glow } = glyph;
        const [mr, mg, mb, ma] = formed.mid;
        put(
          col,
          row,
          char,
          mr + (this.accent[0] - mr) * glow,
          mg + (this.accent[1] - mg) * glow,
          mb + (this.accent[2] - mb) * glow,
          ma + (255 - ma) * glow,
        );
      }
    }
  }

  /** Runs textmode's loop only while there is something to show. */
  private updateLoop() {
    const tm = this.tm;
    if (!tm) return;
    if (this.onScreen && !this.paused && !this.destroyed) {
      this.last = 0;
      if (!tm.isLooping()) tm.loop();
    } else if (tm.isLooping()) {
      tm.noLoop();
    }
  }

  private readonly onToggle = () => {
    this.paused = !this.paused;
    storePaused(this.paused);
    this.renderToggle();
    this.updateLoop();
    // Paused: no ripple in the still frame (redrawn after the loop stops, so it is kept).
    if (this.paused && this.ripple > 0) {
      this.ripple = 0;
      this.tm?.redraw();
    }
  };

  /** Mouse and pen only: a hover effect, and a touch drag scrolls the page. */
  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    this.pointer = { x: event.clientX, y: event.clientY };
  };

  /** The mouse left the window. */
  private readonly onPointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget) this.pointer = undefined;
  };

  private renderToggle() {
    if (!this.toggle) return;
    this.toggle.textContent = this.paused ? 'Play animation' : 'Pause animation';
    this.stage.dataset.paused = String(this.paused);
  }

  private readonly onMotionChange = () => {
    if (this.wantsLive && !this.tm) void this.start();
    else if (!this.wantsLive && this.tm) this.drawStatic();
  };

  private scheduleResize() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.stage.isConnected) {
        destroyHero();
        return;
      }
      const tm = this.tm;
      if (!tm) {
        if (this.stage.dataset.heroAscii === 'static') this.drawStatic();
        return;
      }
      const { width, height, dpr } = this.size();
      tm.fontSize(cellSize(width) * dpr);
      resizeTextmodeCanvas(tm, this.canvas, Math.round(width * dpr), Math.round(height * dpr));
      this.syncGrid();
      // Re-aim the letters at the re-laid-out shape.
      if (this.phase === 'hold') this.settleOnCurrent();
      else if (this.phase !== 'scatter') this.gather();
      tm.redraw();
    });
  }

  private settleOnCurrent() {
    const formed = this.formed[this.shapeIndex];
    if (!formed || formed.cells.length === 0) return;
    this.assign(formed);
    const remaining = this.phaseLength - (this.clock - this.phaseStart);
    this.settle();
    this.phaseLength = Math.max(0, remaining);
  }

  private releaseLive() {
    const tm = this.tm;
    this.tm = undefined;
    this.fps = 0;
    if (!tm) return;
    tm.destroy();
    // destroy() loses the WebGL context; a fresh canvas can take a 2D one.
    const canvas = document.createElement('canvas');
    this.canvas.replaceWith(canvas);
    this.canvas = canvas;
  }

  destroy() {
    this.destroyed = true;
    this.cancelStart();
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.screenObserver.disconnect();
    reducedMotion.removeEventListener('change', this.onMotionChange);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerout', this.onPointerOut);
    this.toggle?.removeEventListener('click', this.onToggle);
    this.releaseLive();
  }
}

let current: HeroBackground | undefined;

function destroyHero() {
  current?.destroy();
  current = undefined;
}

/** Starts the background on the page's [data-hero-ascii] stage, if there is one. Idempotent. */
export function initHeroAscii() {
  const stage = document.querySelector<HTMLElement>('[data-hero-ascii]');
  if (current?.stage === stage) return;
  destroyHero();
  if (stage) current = new HeroBackground(stage);
}

// Free the WebGL context when leaving the page (including into the
// back/forward cache) and start again if the page is restored.
window.addEventListener('pagehide', destroyHero);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) initHeroAscii();
});
document.addEventListener('astro:before-swap', destroyHero);
