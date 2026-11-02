// Client runtime for AsciiImage. Each [data-ascii] root gets one controller:
// it waits until the root nears the viewport, draws the static Canvas 2D
// version, and, when WebGL2 is available and motion is allowed, upgrades to a
// live textmode.js instance. textmode.js is only downloaded at that point.
import type { TextmodeImage, Textmodifier } from 'textmode.js';
import { drawStaticAscii, prepareImage, type PreparedImage } from './raster';

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
  source?: TextmodeImage;
  dpr: number;
  /** Rejects the pending setup when the instance is released early. */
  abort?: () => void;
}

export interface AsciiConfigureDetail {
  characters?: string;
  cellSize?: number;
  forceStatic?: boolean;
}

const MAX_DPR = 2;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const controllers = new Map<HTMLElement, AsciiController>();

let webgl2: boolean | undefined;
/** WebGL2 on real hardware; software-only WebGL counts as unavailable. */
function hasWebGL2() {
  if (webgl2 === undefined) {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    webgl2 = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return webgl2;
}

let textmodeModule: Promise<typeof import('textmode.js')> | undefined;
const loadTextmode = () => (textmodeModule ??= import('textmode.js'));

function monoFont() {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-plex-mono').trim() || 'monospace';
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
  private readonly resizeObserver: ResizeObserver;
  nearViewport = false;

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
    if (this.wantsLive && this.nearViewport) await this.goLive();
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
    if (this.live || !this.prepared || !this.wantsLive) return;
    try {
      await this.createLive();
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
    const url = prepared.url;
    live.source = await new Promise<TextmodeImage>((resolve, reject) => {
      live.abort = () => reject(new DOMException('AsciiImage released', 'AbortError'));
      void tm.setup(async () => {
        try {
          const source = await tm.loadImage(url);
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
    this.showGrid(tm);
    canvas.classList.add('is-ready');
    this.setState('live');
  }

  private drawLive(live: LiveInstance) {
    const { tm, source } = live;
    const grid = tm.grid;
    tm.background(this.config.background);
    if (!source || !grid) return;
    // Cover-fit: scale the aspect-correct size until it fills the whole grid.
    const scale = Math.max(grid.cols / source.width, grid.rows / source.height);
    tm.image(source, Math.ceil(source.width * scale), Math.ceil(source.height * scale));
  }

  /** Exposes the live grid size (e.g. "135x76") for the lab and the tests. */
  private showGrid(tm: Textmodifier) {
    if (tm.grid) this.root.dataset.asciiGrid = `${tm.grid.cols}x${tm.grid.rows}`;
  }

  /** Destroys the live instance (losing its WebGL context); the static layer stays. */
  release() {
    this.generation += 1;
    const live = this.live;
    this.live = undefined;
    if (live) {
      live.abort?.();
      live.tm.destroy();
      live.canvas.remove();
    }
    // The static layer is kept up to date underneath, so it is already correct.
    if (this.prepared) this.setState('static');
  }

  /** Called when reduced motion or the lab's renderer switch changes. */
  refreshMode() {
    if (this.wantsLive) {
      if (this.started && this.nearViewport) void this.goLive();
    } else if (this.live) {
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
    this.release();
    this.resizeObserver.disconnect();
    viewportObserver.unobserve(this.root);
    controllers.delete(this.root);
  }
}

const viewportObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const controller = controllers.get(entry.target as HTMLElement);
      if (!controller) continue;
      controller.nearViewport = entry.isIntersecting;
      if (entry.isIntersecting) void controller.start().then(() => controller.refreshMode());
    }
  },
  { rootMargin: '300px 0px' },
);

/** Finds every AsciiImage root on the page and starts watching it. Idempotent. */
export function initAsciiImages() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-ascii]')) {
    if (controllers.has(root)) continue;
    controllers.set(root, new AsciiController(root));
    viewportObserver.observe(root);
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
