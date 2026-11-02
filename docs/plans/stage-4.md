# Stage 4 plan: ASCII lab

## What I read first (textmode.js 0.18.2 docs + bundled types)
- `textmode.create({ canvas, fontSize, frameRate, loadingScreen })` returns a
  Textmodifier `t`. `fontSize` is the cell size (default font: UrsaFont, a CC0 pixel
  font with square cells). `t.fontSize(n)` changes it later.
- Images: `await t.loadImage(url)` gives a `TextmodeImage`; `.characters(ramp)` sets
  the dark-to-bright ramp; `.charColorMode('sampled')` colors each glyph from the
  source; `.cellColorMode('fixed').cellColor(...)` sets the cell background.
  `t.image(img, cols, rows)` draws it, centred, in grid cells. `img.width/height`
  are the fitted grid size that keeps the aspect ratio.
- Loop: `t.noLoop()` + `t.redraw()` renders on demand; `t.resizeCanvas(w, h)`.
- Cleanup: `t.destroy()` disposes resources, listeners and media; for a context it
  created itself it calls `WEBGL_lose_context.loseContext()` (checked in the bundle).
  With our own `canvas`, destroy() leaves the element in the DOM.
- WebGL2 is required; there is no built-in fallback. `pixelDensity` is ignored for an
  external canvas, so HiDPI is handled by sizing the backing store ourselves.
- `brightnessRange()` filters pixels (it is not a contrast stretch).

## Findings from a prototype
- Works in headless Chromium, but the headless shell renders WebGL with SwiftShader
  (software) and logs "GPU stall due to ReadPixels" warnings. The installed Google
  Chrome uses the real GPU (ANGLE Metal) and logs nothing. → WebGL tests run in the
  `chrome` channel.
- The sample covers come out dim: most cells land on `.` and `:` and dark pixels give
  dark glyphs. → auto-levels on the CPU and brighter covers.

## Approach
`src/components/ascii/`:
- **AsciiImage.astro**. Props: `src` (ImageMetadata or URL), `characters`
  (default `" .:-=+*#%@"`), `cellSize` (CSS px, default 8), `background` (default the
  page background `#0d0c0b`), plus `normalize` (auto-levels, default true) and `alt`
  (decorative unless given). For ImageMetadata it calls `getImage()` for a 720px
  WebP, which is plenty for sampling. Renders a root box that fills its parent, a 2D
  canvas (the static layer) and a `<noscript><img>` so the box is not empty
  without JS.
- **raster.ts**. `prepareImage(url, normalize)`: loads the image, downscales it to at
  most 480px, and (optionally) stretches its brightness so the 2nd–98th percentile
  covers the whole ramp. Cached per URL. The result feeds both renderers, so the
  live and static versions sample identical pixels. `drawStaticAscii()`: the
  fallback. Cover-crops the prepared image to cols × rows (the browser's
  downscale averages each cell), maps luminance to the ramp and fills each glyph
  with its cell's color, using the site's mono font.
- **runtime.ts**. One controller per root, idempotent:
  - Mode: `static` if `prefers-reduced-motion: reduce` or WebGL2 is unavailable
    (`failIfMajorPerformanceCaveat`, so software-only WebGL also falls back);
    otherwise `live`. Reacts to the media query changing at runtime.
  - Lazy: an IntersectionObserver (300px margin) starts a root when it nears the
    viewport. Only then is `textmode.js` dynamically imported (its own chunk,
    about 64 kB gzip), so pages without ASCII, reduced-motion visitors and
    no-WebGL visitors never download it.
  - Start: draw the static layer first (instant poster), then in live mode create
    textmode on a fresh WebGL canvas layered on top: `noLoop()`, a cover-fit
    `t.image()`, one `redraw()`. The live canvas fades in after its first frame.
  - Resize: ResizeObserver → redraw (static) or `resizeCanvas` + redraw (live).
  - Release: `destroy()` (loses the WebGL context) on `pagehide`,
    `astro:before-swap` (Stage 6) and when the root leaves the DOM; restart on
    `pageshow` from the back/forward cache. `release()` is also what Stage 5 will
    call for off-screen cards.
  - `ascii:configure` custom event updates characters and cell size in place (lab).
  - State on the root for styling and tests: `data-ascii-state` = idle | static | live.
- **Dev-only /lab/ascii**: `src/pages/lab/_ascii.astro` (underscore = never routed by
  Astro) injected with `injectRoute` only when `command === 'dev'`, so it can never
  ship. Shows the component on each project cover with a cell-size slider, a
  character-set text box and a renderer switch (auto / static) to compare both.
- Vite `optimizeDeps.include: ['textmode.js']` so the dev server does not re-optimize
  (and reload) the first time the lab is opened.

## Tests (tests/e2e/ascii.spec.ts, Chrome with GPU, against `astro dev`)
Live WebGL render with real colored pixels on every cover; reduced motion → static
and textmode.js never requested; switching reduced motion at runtime swaps to static;
no WebGL2 → static; far-away boxes stay idle until scrolled near; `pagehide` loses
every WebGL context; slider and text box change the grid and the output; no console
warnings or errors. Plus: the production build has no /lab page.

## Critique against the spec, and changes made
- "Fills its parent box": textmode's default fit is *contain*; added cover-fit maths
  (`scale = max(cols / img.width, rows / img.height)`) so there are no empty bands.
- "Each character taking the sampled pixel color": still true, but of the prepared
  image. Auto-levels is a prop (`normalize`) so it can be switched off.
- Live and static must look alike or the upgrade flickers → shared prepared image,
  same grid maths, square cells in both. (The glyph shapes differ: UrsaFont in WebGL,
  IBM Plex Mono in Canvas 2D. Acceptable for a fallback; documented.)
- Many instances × 60 fps loops would waste battery → `noLoop()`; frames are
  rendered only on start, resize and config changes.
- HiDPI: backing store = CSS size × devicePixelRatio (capped at 2), `fontSize` =
  `cellSize × dpr`, so cells stay `cellSize` CSS px and text is crisp.
- "Release the WebGL context": `pagehide`, `astro:before-swap`, and a root found
  disconnected on its next resize/render tick is disposed.
- The loading screen would flash a spinner → `transition: 'none'` and a loading
  renderer that only clears.
