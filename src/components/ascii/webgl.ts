let webgl2: boolean | undefined;

/**
 * WebGL2 on real hardware. Software renderers count as unavailable: they are
 * slower than the static fallback. Browsers flag most of them through
 * failIfMajorPerformanceCaveat; the renderer name catches the rest.
 */
export function hasWebGL2() {
  if (webgl2 === undefined) {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    webgl2 = !!gl && !/swiftshader|llvmpipe|software/i.test(renderer);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return webgl2;
}

/**
 * Resizes a textmode.js canvas to `width` x `height` device pixels. textmode's
 * resizeCanvas() also sets the canvas's inline CSS size to the device-pixel size,
 * which on high-density screens would show it at 2x (cropped); clearing that lets
 * the stylesheet (100% of its box) size it again.
 */
export function resizeTextmodeCanvas(
  tm: { resizeCanvas(width: number, height: number): void },
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  tm.resizeCanvas(width, height);
  canvas.style.width = '';
  canvas.style.height = '';
}

/** A custom property of the page's root, e.g. a color token. */
export function cssToken(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The site's monospace font family (from Astro's Fonts API), for Canvas 2D text. */
export function monoFont() {
  return cssToken('--font-plex-mono') || 'monospace';
}
