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
- Stage 3 committed. Next: Stage 4 (ASCII lab).

## Setup (2026-11-01)
- Keep-awake: `caffeinate -dims` started in the background, **PID 9205**.
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
