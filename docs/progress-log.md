# Progress log

Autonomous build run started 2026-11-01. Instructions: docs/run-instructions.md
(re-read at the start of every stage and after any context compaction).

## How to resume in a new session
1. Read docs/run-instructions.md, CLAUDE.md, ROADMAP.md (Progress list) and this log.
2. `git switch autobuild`. The last "stage N: ..." commit is the last finished stage;
   the "Current status" line below says what was in flight.
3. Keep-awake: check `pgrep -fl "caffeinate -dims"`; start a new one if it is gone
   (`nohup caffeinate -dims >/dev/null 2>&1 &`) and note the new PID here.
4. Privacy check before every commit: `npm run check:private` (it reads the phone
   number from private/ at runtime; never write the number into any file).

## Current status
- Stage 9 committed. Next: Stage 10 (Blog).

## Setup (2026-11-01)
- Keep-awake: `caffeinate -dims` started in the background, **PID 9205** (restarted after
  the crash as **PID 21067**).
- Saved the run prompt to docs/run-instructions.md.
- Git: the folder was not a repository, so the resume cannot be in git history.
  `git init -b main` with one empty root commit ("chore: initialize repository"),
  then branch `autobuild`; all work happens on `autobuild`. Nothing is pushed.
- Resume: moved `Hasan_CV_masters.pdf` to private/ and git-ignored private/ before any
  commit of files. It contains a phone number but no home address.
- "My details" filled in ROADMAP.md (see docs/TODO-for-me.md for the items to confirm).

## Stage 0: Scaffold (done)
- Built: Astro 7.4.4 (minimal template, scaffolded in a temp folder and copied in so
  CLAUDE.md/ROADMAP.md stay untouched), TypeScript strict (`astro/tsconfigs/strict`),
  Tailwind CSS 4.3 via `astro add tailwind` (Vite plugin, src/styles/global.css).
  Minimal BaseLayout plus placeholder pages /, /projects/, /publications/, /blog/,
  /resume/ (each just an h1). .gitignore for Node, Astro, Playwright output, private/.
- Tests (tests/e2e/): smoke (status 200, one h1, title, no console errors, no failed
  same-origin requests, no horizontal overflow at 375px), internal links/assets
  (every href/src in dist/ resolves, page links end in "/", #fragments exist), axe
  (WCAG 2.2 AA + best-practice at 375px and 1280px), opt-in screenshots
  (`SCREENSHOTS=1 npm test -- screenshots`, saved to tests/screenshots/). Pages are
  discovered from dist/, so new pages are covered automatically.
- scripts/check-private.mjs (`npm run check:private`): privacy scan with an in-memory
  self-test; exits 2 if private/ has no resume.
- Checks: `npm run build` OK (5 pages); `npx astro check` 0 errors/0 warnings;
  `npm test` 16 passed (+10 opt-in screenshot tests); screenshots reviewed (bare
  headings, as expected); dev server served all five pages (200). Negative control:
  a planted broken link, missing trailing slash, bad #fragment and console error
  all failed the suite as intended.
- Issues fixed: Astro 7 auto-detaches `astro preview` when an AI agent runs it, which
  made Playwright's webServer exit early and left orphaned servers; fixed with
  `--ignore-lock`. Self-test sample/pattern misalignment in check-private fixed.
- Dev server: `npm run dev` (then open http://localhost:4321).

## Stage 1: Design direction and layout (done)
- Plan: docs/plans/stage-1.md (written, critiqued against the spec, improved, then built).
- Built: design tokens in src/styles/global.css (`@theme`, default palette removed so only
  the "phosphor notebook" tokens exist); IBM Plex Mono + Source Serif 4 via Astro's Fonts
  API (3 preloaded files); src/lib/site.ts (details + nav); SiteHeader (sticky, wordmark,
  one `<nav>` with aria-current, mobile disclosure menu: Esc, focus-out, link click and
  breakpoint change close it; no-JS fallback wraps the links); SiteFooter (terminal-style
  contact block: GitHub, LinkedIn, email); PageHeader (`~/path` eyebrow, h1, blinking
  amber cursor that settles in under 5 s); skip link; layout applied to all five pages.
  CLAUDE.md "Design direction" now lists palette, fonts and the signature cursor.
- Tests added: tests/e2e/nav.spec.ts (desktop nav + aria-current, Tab reaches every link
  at 1280px and at 375px with the menu open, skip link first and focuses main, footer
  links match "My details", mobile menu by mouse/Escape/keyboard only, no-JS fallback);
  tests/e2e/utils/keyboard.ts (reusable tab-through helper).
- Checks: build OK; astro check 0/0/0; `npm test` 24 passed; screenshots at 375/1280 of
  all five pages plus menu-open, no-JS, keyboard focus and skip-link states reviewed.
  Contrast computed for every text token on every surface (lowest: faint on surface-2,
  4.52:1).
- Review fixes: footer label column too narrow for "LinkedIn" (9ch -> 10ch).
- Carry forward to Stage 6: the `js` class on <html> is set by an inline head script;
  client-side navigation must keep it, and initNav() must run on astro:page-load.

## Stage 2: Deploy early (done; push and live check are for the owner)
- Built: .github/workflows/deploy.yml from the current Astro guide: push to `main` +
  `workflow_dispatch`, `actions/checkout@v7`, `withastro/action@v6` (Node 24, npm from the
  lockfile), `actions/deploy-pages@v5`, Pages permissions, `pages` concurrency group.
  astro.config.mjs: `site: SITE.url` (https://arikanhs.github.io), imported from
  src/lib/site.ts so the URL lives in one place; no `base` (user-site repo).
- Not pushed and no GitHub settings changed (per run instructions). The exact Pages
  setting and repo name are in docs/TODO-for-me.md.
- Tests added: tests/e2e/deploy.spec.ts (site URL derives from the username, no base;
  workflow triggers, actions and permissions).
- Checks: build OK; astro check 0/0/0; `npm test` 26 passed; workflow YAML parsed with
  Ruby's YAML loader (jobs build/deploy, triggers, permissions). No pages changed, so no
  new screenshots.
- Done-when ("a push to main publishes the site") needs the owner's GitHub account;
  listed in docs/TODO-for-me.md.

## Stage 3: Content model (done)
- Built: src/content.config.ts with glob loaders and Zod 4 schemas for projects (incl.
  `image()` cover, GitHub-only `repo`), publications (`reference('projects')` for
  projectSlug, BibTeX validated by src/lib/bibtex.ts) and blog (`draft` defaults to false).
  Content: 3 projects (Image2ASCII; GCN-driven CUDA tuning = ml_cuda; Graph algorithms on
  Kokkos = Graph-Algorithms-LBNL), the 2 real publications from the resume (unknown
  authors kept as "et al." / `and others`), 2 labelled sample posts (one with code + math
  for Stage 10). Facts come only from the resume and public READMEs; gaps say "Placeholder".
  Covers: scripts/make-covers.mjs draws 3 deterministic sample images with canvas in
  headless Chromium (sunset/ridges, CUDA heatmap + GCN graph, low-poly triangle mesh).
  /projects: plain grid of cards (title, summary, tags, repo link) sorted by `order`.
- Tests added: tests/e2e/content.spec.ts (grid matches the content files and their order;
  schema cases run `astro sync` on a copy: clean copy passes; missing summary, non-GitHub
  repo and malformed BibTeX fail; a broken projectSlug is reported).
- Checks: build OK; astro check 0/0/0; `npm test` 34 passed; screenshots of /projects at
  375/1280 reviewed. Done-when verified: 3 cards; a real `astro build` of a copy with
  `summary` deleted exits 1 with "summary: Required".
- Found: Astro 7 only *logs* invalid references (does not fail). Stage 6/9 pages that
  resolve projectSlug must throw on a missing project so the build fails.
- Review fixes: removed a hover border from the not-yet-clickable cards; regenerated the
  low-poly cover with a brighter ramp.

## Crash during Stage 4 (2026-11-01)
- The machine crashed while `npm test -- ascii` was running. Cause found on restart: a
  find-and-replace had turned the `page.goto()` inside the test helper `openLab()` into a
  call to `openLab()` itself, so every ASCII test recursed forever inside `toPass()` in six
  workers. An earlier run with the same bug had already hung for 10 minutes.
- Fixed the helper; ASCII tests now run in one worker (`test.describe.configure({ mode:
  'default' })`), lab navigation has its own 10 s timeout, and the suite has a 10-minute
  `globalTimeout`. Nothing was lost: Stages 0-3 were committed; Stage 4 files were intact.

## Stage 4: ASCII lab (done)
- Plan: docs/plans/stage-4.md (docs read first: install, lifecycle, media, conversion,
  grid, colors, ramps, loading, framework integration, plus the bundled .d.ts files).
- Built: textmode.js 0.18.2 (exact). src/components/ascii/: AsciiImage.astro (props src,
  characters, cellSize, background, normalize, alt), raster.ts (prepared image with
  auto-levels; Canvas 2D fallback), runtime.ts (lazy IntersectionObserver start, dynamic
  import of textmode.js, live/static modes, reduced-motion and no-WebGL2 fallback incl.
  runtime switching, ResizeObserver, release on pagehide/astro:before-swap, ascii:configure
  events). Dev-only /lab/ascii (src/pages/lab/_ascii.astro, injected only by `astro dev`)
  with cell-size slider, character-set box and renderer switch. Brighter sample covers.
- Tests: tests/e2e/ascii.spec.ts (8, Chrome with GPU, one worker): live colored output on
  every cover with a clean console; reduced motion -> static and textmode.js never
  requested; runtime reduced-motion switch; no WebGL2 -> static; lazy start; pagehide
  loses every WebGL context; lab controls change the output; no /lab in the build.
- Checks: build OK; astro check 0/0/0 (test-results/ now excluded from tsconfig);
  `npm test` 40 passed; lab screenshots at 375/1280, live and reduced motion, reviewed.
- Found and fixed: textmode's setup() resolves before its callback runs (wrapped in an
  abortable promise); static and live glyph mapping aligned with textmode's shader
  (Rec. 601 luma, round(b*(n-1))); fallback glyphs made heavier to match ink; an image
  load interrupted by pagehide no longer leaves a box idle; the test-helper recursion that
  crashed the machine (see "Crash during Stage 4").
- Owner check: whether the look matches Image2ASCII output (docs/TODO-for-me.md).

## Stage 5: Projects section with ASCII cards (done)
- Plan: docs/plans/stage-5.md.
- Built: ProjectCard (ASCII cover fills the card, text on a 90% scrim, art at 70% at rest
  and 100% on hover/focus-within, amber border, summary clamped to 3 lines), ProjectGrid
  (featured: 2 of 2 columns from 768px, half of a 6-column row from 1024px, taller),
  /projects uses it, home has a "Selected work" section with the featured cards.
  runtime.ts: near viewport -> static snapshot; on screen -> live after 150 ms, released
  600 ms after leaving; at most 6 live instances with a waiting queue; hover/focus effect
  ("reveal": random glyphs settle into the image over 600 ms; "dissolve": a soft scatter
  over 450 ms) drawn as textmode overdraw on unsettled cells, ending on the exact resting
  frame. raster.ts: shared per-cell sampler. Dev-only /lab/cards with 10 cards.
- Tests: tests/e2e/cards.spec.ts (GPU Chrome): 10 cards scrolled down and up by wheel:
  max live <= 6, nothing live off screen after settling, frame-time p95 < 50 ms, no console
  warnings; hover reveal/dissolve end on the resting frame; keyboard focus plays it;
  reduced motion stays static. tests/e2e/projects.spec.ts: ASCII on every card, featured
  larger, canvases aria-hidden, home "Selected work". tests/e2e/utils/ascii.ts helpers.
- Checks: build OK; astro check 0/0/0; `npm test` 47 passed (+10 opt-in screenshots);
  screenshots of /projects (rest, mid-hover, 375px) and home reviewed.
- Review fixes: art too faint at rest (55% -> 70%, taller cards, shorter scrim lead-in);
  live canvas was marked ready before its first frame was drawn.

## Stage 6: Project pages and view transitions (done)
- Built: /projects/[slug] from the Markdown body: ASCII header (same `transition:name` as
  the card, plays the reveal once on arrival via `intro`), `~/projects/<id>` path, h1 with
  cursor, summary, tags, "View code on GitHub" (+ "Live demo" when `demo` is set), body in
  shared `.prose` styles, "Related publications" aside (projectSlug match).
  `<ClientRouter />` site-wide; the `js` class is re-added to the incoming document in
  `astro:before-swap`; initNav and initAsciiImages run on `astro:page-load`; card titles
  are stretched links to the project page. src/lib/content.ts: getProjects() and
  getPublications(), which throws on a projectSlug with no project (build fails).
  Shared `.button`/`.button-primary` and `.prose` styles in global.css.
- Tests: tests/e2e/transitions.spec.ts (GPU): card click morphs (view transition captured
  the shared name, no reload), Back morphs back; 3 rounds over every project keep ASCII
  rendering, <= 6 live contexts, clean console; reduced motion navigates without
  animation. tests/e2e/project-page.spec.ts: detail content, related box, card links,
  mobile menu and `js` class after client-side navigation. content.spec: a broken
  projectSlug now fails `astro build`.
- Checks: build OK (8 pages); astro check 0/0/0; `npm test` 64 passed; screenshots of a
  project page at 375/1280 and after a card click reviewed.
- Note: Astro's ClientRouter logs a console warning under reduced motion (animations off);
  tests treat that one message as expected.

## Stage 7: Terminal hero (done)
- Built: src/components/ui/TerminalHero.astro on the home page: a terminal window (title
  bar, faint scanlines, amber glow) with `~ $ whoami`, the name (h1) and intro as output,
  then focus / status / links (GitHub, email, cv) as a definition list, and a final
  prompt with the amber cursor. All text is plain HTML. An inline script adds
  `.is-typing` before first paint only on the first visit of a session with motion
  allowed; CSS then types the command (steps() over `ch` widths) and reveals output on a
  schedule (~2 s). SITE gained `focus` and `status` (from the resume).
- Also: runtime.ts now treats software WebGL renderers (SwiftShader, llvmpipe) as
  unavailable; the headless shell had slipped past failIfMajorPerformanceCaveat.
- Tests: tests/e2e/hero.spec.ts (text in served HTML; types once per session; reduced
  motion shows final state; no-JS at 375px complete and fitting; link targets).
- Checks: build OK; astro check 0/0/0; `npm test` 69 passed; screenshots at 1280, 375,
  375 without JS and mid-typing reviewed.
- Carry forward to Stage 8: the hero's "cv" link points to /resume/; switch it to
  /cv.pdf once that file exists.

## Stage 8: Resume (done)
- Built: src/data/resume.yaml from the resume PDF text (no phone, no address), loaded as
  a `resume` content collection (file() loader) whose schema rejects phone-number-like
  text. /resume: summary, Download PDF, timelines (Timeline.astro) for education,
  experience and projects/involvement, publications from the collection, skills grouped
  by area, awards and certifications. Print stylesheet: tokens remapped to black on
  white, light canvas, 9pt root, dates beside entries, no site chrome, a print-only name
  and contact header, @page margins. scripts/export-cv.mjs + `npm run cv` print /resume
  to public/cv.pdf (Letter, tagged). Hero "cv" link now points to /cv.pdf.
- Tests: tests/e2e/resume.spec.ts (sections and timeline counts from the YAML; Download
  PDF -> existing cv.pdf with the owner's name; prints to <= 2 pages on A4 and on Letter,
  chrome hidden, no overflow at the printable width). content.spec: a phone number in
  resume.yaml fails the build.
- Checks: build OK; astro check 0/0/0; `npm test` 74 passed; cv.pdf read page by page
  (2 pages, clean); screenshots at 375/1280 reviewed; privacy check scanned the PDF text.
- Review fixes: dark page frame in print (dark color-scheme canvas), print type too big
  (3 pages -> 2), cramped date column for "Spring 2023 – Fall 2023".

## Stage 9: Publications (done)
- Built: /publications grouped by year (newest first), each entry with title (links to
  the paper), authors with the owner in bold (first + last name match), venue, buttons
  PDF (when set), Code (repo) and Project (when projectSlug is set), Copy BibTeX
  (clipboard + toast in a role="status" live region; graceful message if the clipboard
  is blocked) and a `<details>` BibTeX block that works without JS. Tag filter chips
  (aria-pressed, hidden without JS, count announced). Scripts init on astro:page-load.
- Tests: tests/e2e/publications.spec.ts (year order and bold owner; Code/Project hrefs
  match each file; Copy BibTeX gives exactly the source, parses, balanced braces, toast;
  filters and reset; open BibTeX does not overflow at 375px; no-JS fallback).
- Checks: build OK; astro check 0/0/0; `npm test` 80 passed; screenshots at 1280/375
  reviewed (filtered, BibTeX open, toast).
- Review fix: an open BibTeX block widened the page at 375px (grid item min-width).
