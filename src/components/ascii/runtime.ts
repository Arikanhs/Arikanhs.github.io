// Client runtime for AsciiImage. Each [data-ascii] root gets one controller:
// when the root nears the viewport it draws the static Canvas 2D version;
// while it is on screen, and WebGL2 is available and motion is allowed, it
// upgrades to a live textmode.js instance (at most MAX_LIVE at a time).
// textmode.js is only downloaded at that point.
import type { TextmodeTexture, Textmodifier } from 'textmode.js';
import { drawStaticAscii, prepareImage, sampleCells, type PreparedImage } from './raster';

export type AsciiState = 'idle' | 'static' | 'live';

interface Config {
  src: string;
  characters: string;
  cellSize: number;
  background: string;
  normalize: boolean;
  /** Lab only: keep the Canvas 2D renderer even when WebGL is allowed. */
  forceStatic: boolean;
}

interface LiveInstance {
  tm: Textmodifier;
  canvas: HTMLCanvasElement;
  source?: TextmodeTexture;
  dpr: number;
  /** Rejects the pending setup when the instance is released early. */
  abort?: () => void;
}

/** Hover/focus animation: "reveal" resolves random glyphs into the image, "dissolve" scatters a few. */
interface Effect {
  kind: 'reveal' | 'dissolve';
  start: number;
  duration: number;
}

/** Per-grid data for the effect: each cell's color and its random settle order. */
interface CellData {
  key: string;
  colors: Uint8ClampedArray;
  ranks: Float32Array;
}

export interface AsciiConfigureDetail {
  characters?: string;
  cellSize?: number;
  forceStatic?: boolean;
}

const MAX_DPR = 2;
/** Live WebGL instances allowed at once; further on-screen roots wait their turn. */
export const MAX_LIVE = 6;
/** Delays that keep a fast scroll from creating and destroying contexts. */
const GO_LIVE_DELAY = 150;
const RELEASE_DELAY = 600;
const REVEAL_MS = 600;
const DISSOLVE_MS = 450;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const controllers = new Map<HTMLElement, AsciiController>();
const waiting = new Set<AsciiController>();

let webgl2: boolean | undefined;
/**
 * WebGL2 on real hardware. Software renderers count as unavailable: they are
 * slower than the static fallback. Browsers flag most of them through
 * failIfMajorPerformanceCaveat; the renderer name catches the rest.
 */
function hasWebGL2() {
  if (webgl2 === undefined) {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    webgl2 = !!gl && !/swiftshader|llvmpipe|software/i.test(renderer);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return webgl2;
}

let textmodeModule: Promise<typeof import('textmode.js')> | undefined;
const loadTextmode = () => (textmodeModule ??= import('textmode.js'));

function monoFont() {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-plex-mono').trim() || 'monospace';
}

function liveCount() {
  let count = 0;
  for (const controller of controllers.values()) if (controller.holdsSlot) count += 1;
  return count;
}

/** Gives free live slots to on-screen roots that are waiting, in arrival order. */
function fillSlots() {
  for (const controller of waiting) {
    if (liveCount() >= MAX_LIVE) return;
    waiting.delete(controller);
    if (controller.onScreen) void controller.goLive();
  }
}

class AsciiController {
  private config: Config;
  private readonly staticCanvas: HTMLCanvasElement;
  private prepared?: PreparedImage;
  private live?: LiveInstance;
  private started = false;
  /** Bumped on release, so async work that finishes late is discarded. */
  private generation = 0;
  private frame = 0;
  private visibilityTimer = 0;
  private readonly resizeObserver: ResizeObserver;
  private effect?: Effect;
  private effectFrame = 0;
  private cells?: CellData;
  private hovered = false;
  private focused = false;
  private introPlayed = false;
  /** True from the start of goLive() until release: counts against MAX_LIVE. */
  holdsSlot = false;
  nearViewport = false;
  onScreen = false;

  constructor(readonly root: HTMLElement) {
    const data = root.dataset;
    this.config = {
      src: data.src ?? '',
      characters: data.characters || ' .:-=+*#%@',
      cellSize: Number(data.cellSize) || 8,
      background: data.background || '#0d0c0b',
      normalize: data.normalize !== 'false',
      forceStatic: false,
    };
    this.staticCanvas = root.querySelector('canvas.ascii-static') ?? root.appendChild(document.createElement('canvas'));
    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.resizeObserver.observe(root);
    root.addEventListener('ascii:configure', (event) =>
      this.configure((event as CustomEvent<AsciiConfigureDetail>).detail),
    );

    // A card (or any ancestor) marked data-ascii-trigger plays the effect on
    // hover and keyboard focus.
    const trigger = root.closest<HTMLElement>('[data-ascii-trigger]');
    if (trigger) {
      trigger.addEventListener('pointerenter', () => this.setActive({ hovered: true }));
      trigger.addEventListener('pointerleave', () => this.setActive({ hovered: false }));
      trigger.addEventListener('focusin', () => this.setActive({ focused: true }));
      trigger.addEventListener('focusout', (event) => {
        if (!trigger.contains(event.relatedTarget as Node | null)) this.setActive({ focused: false });
      });
    }
  }

  get wantsLive() {
    return !this.config.forceStatic && !reducedMotion.matches && hasWebGL2();
  }

  private setState(state: AsciiState) {
    if (this.root.dataset.asciiState === state) return;
    this.root.dataset.asciiState = state;
    this.root.dispatchEvent(new CustomEvent('ascii:state', { detail: state }));
  }

  private size() {
    const rect = this.root.getBoundingClientRect();
    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      dpr: Math.min(MAX_DPR, window.devicePixelRatio || 1),
    };
  }

  /** Near the viewport: load the image and draw the static layer (once). */
  async start() {
    if (this.started) return;
    this.started = true;
    try {
      this.prepared = await prepareImage(this.config.src, this.config.normalize);
      await document.fonts.load(`600 ${this.config.cellSize}px ${monoFont()}`);
    } catch (error) {
      console.warn('AsciiImage: could not load', this.config.src, error);
      this.started = false;
      return;
    }
    // Always draw the static layer, even if the page was hidden meanwhile: it is
    // cheap, and it is what shows until (and unless) the live version takes over.
    this.renderStatic();
    this.setState('static');
    this.refreshMode();
  }

  /** On or off screen: go live after a short delay, release a while after leaving. */
  setOnScreen(onScreen: boolean) {
    this.onScreen = onScreen;
    clearTimeout(this.visibilityTimer);
    this.visibilityTimer = window.setTimeout(
      () => {
        if (this.onScreen) this.refreshMode();
        else {
          waiting.delete(this);
          this.release();
        }
      },
      onScreen ? GO_LIVE_DELAY : RELEASE_DELAY,
    );
  }

  private renderStatic() {
    if (!this.prepared) return;
    const { width, height, dpr } = this.size();
    const { cols, rows } = drawStaticAscii(
      this.staticCanvas,
      this.prepared,
      { ...this.config, fontFamily: monoFont() },
      width,
      height,
      dpr,
    );
    if (!this.live) this.root.dataset.asciiGrid = `${cols}x${rows}`;
  }

  async goLive() {
    if (this.holdsSlot || !this.prepared || !this.wantsLive) return;
    if (liveCount() >= MAX_LIVE) {
      waiting.add(this);
      return;
    }
    this.holdsSlot = true;
    try {
      await this.createLive();
      // createLive() bails out if the root went away or motion was turned off.
      if (!this.live && this.holdsSlot) this.release();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.warn('AsciiImage: WebGL rendering failed; showing the static version.', error);
      textmodeModule = undefined;
      this.release();
    }
  }

  private async createLive() {
    const prepared = this.prepared;
    if (!prepared) return;
    const generation = this.generation;
    const { textmode } = await loadTextmode();
    if (generation !== this.generation || this.live || !this.wantsLive || !this.root.isConnected) return;

    const { width, height, dpr } = this.size();
    const canvas = document.createElement('canvas');
    canvas.className = 'ascii-live';
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    this.root.append(canvas);

    const tm = textmode.create({
      canvas,
      fontSize: this.config.cellSize * dpr,
      loadingScreen: { transition: 'none' },
    });
    const live: LiveInstance = { tm, canvas, dpr };
    this.live = live;
    tm.loading.draw(({ textmodifier }) => textmodifier.clear());
    tm.draw(() => this.drawLive(live));

    // setup() only registers the callback; it runs once the renderer is ready.
    // Errors are caught here because textmode.js would paint its own error screen.
    // The prepared canvas is used directly as a texture (no image re-encoding).
    live.source = await new Promise<TextmodeTexture>((resolve, reject) => {
      live.abort = () => reject(new DOMException('AsciiImage released', 'AbortError'));
      void tm.setup(async () => {
        try {
          const source = tm.createTexture(prepared.canvas);
          source
            .characters(this.config.characters)
            .charColorMode('sampled')
            .cellColorMode('fixed')
            .cellColor(this.config.background);
          resolve(source);
        } catch (error) {
          reject(error);
        }
      });
    });
    if (this.live !== live) return; // released while loading
    tm.noLoop();
    tm.redraw();
    // redraw() renders on the next frame: show the canvas only once it has content.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (this.live !== live) return;
    this.showGrid(tm);
    canvas.classList.add('is-ready');
    this.setState('live');
    // Hovered while it was still loading, or an intro is wanted: reveal now.
    const intro = this.root.hasAttribute('data-ascii-intro') && !this.introPlayed;
    this.introPlayed = true;
    if (this.hovered || this.focused || intro) this.play('reveal');
  }

  private drawLive(live: LiveInstance) {
    const { tm, source } = live;
    const grid = tm.grid;
    tm.background(this.config.background);
    if (!source || !grid) return;
    // Cover-fit: scale the aspect-correct size until it fills the whole grid.
    const scale = Math.max(grid.cols / source.width, grid.rows / source.height);
    tm.image(source, Math.ceil(source.width * scale), Math.ceil(source.height * scale));
    if (this.effect) this.drawEffect(tm, grid.cols, grid.rows, this.effect);
  }

  /**
   * Overdraws the cells that have not settled yet with a random glyph in the
   * cell's own color, on an opaque cell, so they hide the converted glyph.
   */
  private drawEffect(tm: Textmodifier, cols: number, rows: number, effect: Effect) {
    if (!this.prepared) return;
    const key = `${cols}x${rows}`;
    if (this.cells?.key !== key) {
      const ranks = new Float32Array(cols * rows);
      for (let i = 0; i < ranks.length; i += 1) ranks[i] = Math.random();
      this.cells = { key, colors: sampleCells(this.prepared, cols, rows), ranks };
    }
    const { colors, ranks } = this.cells;
    const t = Math.min(1, (performance.now() - effect.start) / effect.duration);
    // reveal: cells settle in rank order with an ease-out; dissolve: a scatter
    // that peaks at about a third of the cells half-way and settles back.
    const settled = effect.kind === 'reveal' ? 1 - (1 - t) ** 3 : 0;
    const scattered = effect.kind === 'dissolve' ? 0.35 * Math.sin(Math.PI * t) : 1;
    const glyphs = Array.from(this.config.characters.replace(/\s/g, ''));
    if (glyphs.length === 0) glyphs.push('#');
    // textmode's origin is the centre cell: column offset ceil(cols/2) - 1, row offset floor(rows/2).
    const colOffset = Math.ceil(cols / 2) - 1;
    const rowOffset = Math.floor(rows / 2);
    tm.cellColor(this.config.background);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const i = row * cols + col;
        const rank = ranks[i];
        const scrambled = effect.kind === 'reveal' ? rank >= settled : rank < scattered;
        if (!scrambled) continue;
        tm.push();
        tm.translate(col - colOffset, row - rowOffset);
        tm.char(glyphs[(Math.random() * glyphs.length) | 0]);
        tm.charColor(colors[i * 4], colors[i * 4 + 1], colors[i * 4 + 2]);
        tm.point();
        tm.pop();
      }
    }
  }

  private setActive(change: { hovered?: boolean; focused?: boolean }) {
    const wasActive = this.hovered || this.focused;
    this.hovered = change.hovered ?? this.hovered;
    this.focused = change.focused ?? this.focused;
    const active = this.hovered || this.focused;
    if (active !== wasActive) this.play(active ? 'reveal' : 'dissolve');
  }

  /** Runs an effect on the live instance; static versions only fade (CSS). */
  private play(kind: Effect['kind']) {
    const live = this.live;
    if (!live?.source || reducedMotion.matches) return;
    this.effect = { kind, start: performance.now(), duration: kind === 'reveal' ? REVEAL_MS : DISSOLVE_MS };
    this.root.dataset.asciiEffect = kind;
    cancelAnimationFrame(this.effectFrame);
    const tick = () => {
      const effect = this.effect;
      if (!effect || this.live !== live) return;
      if (performance.now() - effect.start >= effect.duration) {
        this.stopEffect();
        live.tm.redraw();
        return;
      }
      live.tm.redraw();
      this.effectFrame = requestAnimationFrame(tick);
    };
    this.effectFrame = requestAnimationFrame(tick);
  }

  private stopEffect() {
    cancelAnimationFrame(this.effectFrame);
    this.effect = undefined;
    delete this.root.dataset.asciiEffect;
  }

  /** Exposes the live grid size (e.g. "135x76") for the lab and the tests. */
  private showGrid(tm: Textmodifier) {
    if (tm.grid) this.root.dataset.asciiGrid = `${tm.grid.cols}x${tm.grid.rows}`;
  }

  /** Destroys the live instance (losing its WebGL context); the static layer stays. */
  release() {
    this.generation += 1;
    this.stopEffect();
    const live = this.live;
    this.live = undefined;
    if (live) {
      live.abort?.();
      live.tm.destroy();
      live.canvas.remove();
    }
    // The static layer is kept up to date underneath, so it is already correct.
    if (this.prepared) this.setState('static');
    if (this.holdsSlot) {
      this.holdsSlot = false;
      fillSlots();
    }
  }

  /** Goes live or static to match visibility, reduced motion and WebGL support. */
  refreshMode() {
    if (this.wantsLive) {
      if (this.started && this.onScreen) void this.goLive();
    } else if (this.holdsSlot) {
      this.release();
    }
  }

  configure(detail: AsciiConfigureDetail) {
    if (detail.characters !== undefined && detail.characters.length > 0) {
      this.config.characters = detail.characters;
      this.live?.source?.characters(detail.characters);
    }
    if (detail.cellSize !== undefined && detail.cellSize > 0) {
      this.config.cellSize = detail.cellSize;
      if (this.live) this.live.tm.fontSize(detail.cellSize * this.live.dpr);
    }
    if (detail.forceStatic !== undefined) this.config.forceStatic = detail.forceStatic;
    this.scheduleRender();
    this.refreshMode();
  }

  private scheduleRender() {
    if (!this.started || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.root.isConnected) {
        this.dispose();
        return;
      }
      this.renderStatic();
      const live = this.live;
      if (live?.source) {
        const { width, height, dpr } = this.size();
        if (dpr !== live.dpr) {
          live.dpr = dpr;
          live.tm.fontSize(this.config.cellSize * dpr);
        }
        live.tm.resizeCanvas(Math.round(width * dpr), Math.round(height * dpr));
        live.tm.redraw();
        this.showGrid(live.tm);
      }
    });
  }

  /** Stops observing and releases everything (the root is gone). */
  dispose() {
    clearTimeout(this.visibilityTimer);
    waiting.delete(this);
    this.release();
    this.resizeObserver.disconnect();
    nearObserver.unobserve(this.root);
    screenObserver.unobserve(this.root);
    controllers.delete(this.root);
  }
}

// Near the viewport: prepare and draw the static version ahead of time.
const nearObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const controller = controllers.get(entry.target as HTMLElement);
      if (!controller) continue;
      controller.nearViewport = entry.isIntersecting;
      if (entry.isIntersecting) void controller.start();
    }
  },
  { rootMargin: '300px 0px' },
);

// Actually on screen: eligible for a live WebGL instance.
const screenObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) controllers.get(entry.target as HTMLElement)?.setOnScreen(entry.isIntersecting);
});

/** Finds every AsciiImage root on the page and starts watching it. Idempotent. */
export function initAsciiImages() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-ascii]')) {
    if (controllers.has(root)) continue;
    controllers.set(root, new AsciiController(root));
    nearObserver.observe(root);
    screenObserver.observe(root);
  }
}

reducedMotion.addEventListener('change', () => {
  for (const controller of controllers.values()) controller.refreshMode();
});

// Free every WebGL context when the page goes away (including into the
// back/forward cache) and come back live if the page is restored.
window.addEventListener('pagehide', () => {
  for (const controller of controllers.values()) controller.release();
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  for (const controller of controllers.values()) controller.refreshMode();
});
// Client-side navigation (Astro's <ClientRouter />) replaces the page's DOM.
document.addEventListener('astro:before-swap', () => {
  for (const controller of [...controllers.values()]) controller.dispose();
});
