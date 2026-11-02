# Decisions

Design and tech decisions made during the autonomous build, newest stage last.
Each entry says what was chosen and why.

## Setup

- **Git layout.** The folder was not a git repo. Created `main` with a single empty
  root commit so that `autobuild` can later be fast-forward merged into `main`.
  All work is committed on `autobuild`; nothing is pushed.
- **GitHub username: `Arikanhs`.** Not on the resume. Taken from the GitHub CLI login
  on this machine and confirmed via the public GitHub API (profile name "Hasan Arikan",
  public repos `ml_cuda`, `Graph-Algorithms-LBNL`, `ML-NREL`, `Alpha-Fold-LBNL`,
  `gov_job_finder`). The local git `user.name` (`hsarikan`) is not a GitHub account.
- **Site URL: `https://arikanhs.github.io`.** GitHub Pages serves user sites on the
  lowercased hostname, so the canonical URL uses lowercase.
- **Email: `Arikan@unlv.nevada.edu`** (from the resume) rather than the git email.
- **Privacy check.** The resume has a phone number and no home address. The check
  script reads the number from the private PDF at runtime and searches the working
  tree (including public/, dist/ and the text of every PDF) for it in any formatting,
  plus a generic street-address pattern. The number itself is never written to a file.

## Stage 0

- **Astro 7.4.4** (latest stable on 2026-11-01) with Vite 8 and Zod 4.
- **Dependencies added** (all dev except Astro/Tailwind):
  - `tailwindcss`, `@tailwindcss/vite`: required by CLAUDE.md; added with `astro add tailwind`.
  - `@astrojs/check`, `typescript@^6`: `astro check`. TypeScript 7 is out, but
    `@astrojs/check` only supports TypeScript 5 or 6.
  - `@types/node@^24`: type-checks the Node APIs used in tests and scripts.
  - `@playwright/test`, `@axe-core/playwright`: required test setup (smoke, links, axe).
    Only Playwright's headless Chromium shell is installed.
  - `unpdf`: extracts text and links from PDFs so the privacy check can read the
    phone number from the private resume and scan generated PDFs (public/cv.pdf).
    Small, zero-dependency wrapper around Mozilla's PDF.js.
- **Pages discovered from dist/.** `npm test` builds first, then the tests enumerate
  dist/**/index.html, so every page any later stage adds is smoke-, link- and
  axe-tested without editing the tests.
- **Trailing slashes.** GitHub Pages serves directory indexes and redirects
  `/projects` to `/projects/`, so internal page links always end in "/" and the
  link test enforces it.
- **`--ignore-lock` on the test server.** Astro 7 detaches `astro preview` into the
  background when it detects an AI agent; the flag keeps a normal foreground server
  for Playwright and is harmless in a regular terminal.
- **frontend-design skill unavailable.** CLAUDE.md asks for it, but it is not
  installed in this environment. UI work follows its principles instead: a committed
  aesthetic direction, distinctive type, one accent, purposeful motion.

## Stage 1

- **Direction "phosphor notebook".** Interface text (nav, headings, labels) is monospace;
  reading text is a serif. The serif suggests papers, the mono suggests the terminal.
- **Accent amber `#ffb000`** rather than the usual terminal green: warmer, more distinctive,
  10.7:1 on the background. Tailwind's default colors are removed (`--color-*: initial`) so
  a second hue cannot creep in.
- **Fonts: IBM Plex Mono + Source Serif 4**, self-hosted by Astro's Fonts API (no font
  packages, no third-party requests at runtime, metric-matched fallbacks). Mono has no
  italic (not needed for UI); the serif is one variable file per style.
- **Signature: the phosphor cursor.** It blinks 4 times (4.4 s) then stays solid, which
  keeps it under WCAG 2.2.2's 5-second limit without a pause control.
- **Mobile nav is a disclosure, not a modal.** WAI's recommended pattern for site
  navigation; no focus trap is needed. One `<nav>` serves both layouts, so links are never
  duplicated in the tab order. Without JS the list wraps under the wordmark.
- **Footer links are text, not icons.** "GitHub github.com/Arikanhs" reads well to
  everyone and fits the terminal look; `rel="me"` on the profile links.

## Stage 2

- **Action versions** pinned to the current majors the Astro docs use and that exist as
  tags: `actions/checkout@v7`, `withastro/action@v6`, `actions/deploy-pages@v5`.
- **Concurrency group `pages`** (not in the Astro sample) so two quick pushes cannot
  deploy at the same time; a running deployment is allowed to finish.
- **No test job in the deploy workflow.** The roadmap asks only for deployment, and the
  Playwright suite needs browsers in CI. Tests run locally (`npm test`) before every commit.
- **User-site repo `Arikanhs.github.io`** so `site` is the bare github.io URL and every
  internal link can stay root-relative.

## Stage 3

- **Real data, marked gaps.** The samples use the two real publications and projects
  from the resume and the public repos instead of lorem ipsum. Anything not in those
  sources (dates, full author lists, write-ups) is marked "Placeholder".
- **Repo-to-paper mapping** from READMEs and the resume: `ml_cuda` = HPEC 2025 GCN/CUDA
  paper (IEEE 11196239), `Graph-Algorithms-LBNL` = IPDPSW 2024 Kokkos paper (IEEE 10596346);
  the IEEE links were matched to papers by their position in the resume PDF.
- **`et al.` in BibTeX is `and others`**, which is valid BibTeX and renders as "et al.".
- **Schema strictness:** `repo` must be https://github.com/owner/repo; `bibtex` must parse
  as one entry with title, author and year; `projectSlug` uses `reference('projects')`.
  `featured` is required (the spec lists it), `draft` defaults to false.
- **Generated covers** instead of stock photos: no licensing questions, reproducible, and
  shaped for ASCII (big shapes, strong brightness ramps, saturated color).
- **`astro sync` in schema tests.** It runs the same content validation as `astro build`
  in about 2 s on a temporary copy, so the tests never touch the real content files.

## Stage 4

- **textmode.js pinned to exactly 0.18.2** (`--save-exact`), the latest stable release
  (a 1.0.0 beta exists; not used). It is loaded with a dynamic `import()` only when a
  box nears the viewport and only if WebGL2 is allowed: about 64 kB gzipped, in its own chunk.
- **Default font kept.** textmode.js's bundled UrsaFont (CC0 pixel font, square cells)
  reads as "terminal output" and costs nothing extra. The Canvas 2D fallback draws
  IBM Plex Mono 600 at 1.25x the cell so its glyph "ink" is close to the pixel font.
- **One prepared image feeds both renderers.** Each cover is downscaled to at most 480 px
  and auto-levelled (2nd-98th brightness percentile stretched to the full range), then
  handed to textmode.js as an object URL and to the fallback as a canvas. Both renderers
  use Rec. 601 luma and `round(brightness * (n - 1))`, textmode's own mapping (read from its
  shader), so the static and live versions pick the same characters.
- **Software WebGL counts as "no WebGL"** (`failIfMajorPerformanceCaveat`): a CPU-rendered
  WebGL canvas is slower than the static fallback and logs GPU-stall warnings.
- **Render on demand.** `noLoop()` + `redraw()` on start, resize and config changes; no
  60 fps loop for a still image.
- **HiDPI by hand.** `pixelDensity` is ignored for an external canvas, so the backing store
  is CSS size x devicePixelRatio (capped at 2) and `fontSize` = cell size x dpr.
- **Context release** on `pagehide`, `astro:before-swap` and root removal via
  `destroy()`, which calls `WEBGL_lose_context.loseContext()` for contexts it created.
- **Dev-only lab** at /lab/ascii: `src/pages/lab/_ascii.astro` (underscore: never routed)
  injected by a small integration only when `command === 'dev'`.
- **WebGL tests run in the installed Google Chrome** (`chrome-gpu` Playwright project,
  one worker): Playwright's headless shell only has SwiftShader software WebGL.
