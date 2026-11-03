# Hasan Serdar Arikan: personal website

The personal site of Hasan Serdar Arikan, a master's student in machine learning, AI and
cybersecurity. The home page has an animated ASCII background: letters fly in from the
sides and form a bird (which winks, then flies off), a detective (whose hat turns white, blue, then red), a robot
(eyes and antenna light up) and a computer chip (data pulses along its pins). Sections: projects (a list beside a
viewer that shows the selected project's cover), publications (with code links and BibTeX), a blog (code, math, RSS) and a
resume (with a printable PDF).

Built with [Astro](https://astro.build) 7, TypeScript (strict) and Tailwind CSS 4.
The ASCII backgrounds use [textmode.js](https://code.textmode.art) (WebGL2) with a Canvas
2D fallback. Deployed to GitHub Pages.

## Run it

Requires Node.js 22.23 or newer (24 recommended).

```sh
npm install
npm run dev        # http://localhost:4321 (dev-only pages: /lab/ascii, /lab/cards, /lab/home)
npm run build      # production build in dist/
npm run preview    # serve dist/
```

### Checks

```sh
npx astro check                          # types
npm test                                 # builds, then runs the Playwright suite
SCREENSHOTS=1 npm test -- screenshots    # full-page screenshots into tests/screenshots/
npm run check:private                    # privacy scan (see below)
```

First run of the tests: `npx playwright install --only-shell chromium`. The WebGL
tests (`ascii`, `hero-ascii`, `cards`, `transitions`) use your installed Google Chrome, because
Playwright's own headless Chromium only has software WebGL.

### Other scripts

| Command | What it does |
|---|---|
| `npm run cv` | Prints the built /resume page to `public/cv.pdf` (run after editing the resume). |
| `npm run assets` | Regenerates the favicons and the social image `public/og.png`. |
| `node scripts/make-covers.mjs` | Regenerates the sample project covers. |

## Add content

All content lives in `src/content/` and is validated at build time; a missing or
malformed field fails the build with a clear message.

### A project

Create `src/content/projects/<id>.md` (the file name is the URL: `/projects/<id>/`) and
put its cover image in `src/assets/projects/`:

```md
---
title: My project
summary: One or two sentences for the card.
date: 2026-11-01
tags: [Python, ML]
repo: https://github.com/Arikanhs/my-project   # must be a GitHub repository URL
demo: https://example.com                      # optional
cover: ../../assets/projects/my-project.jpg    # shown in the /projects viewer; ASCII art on cards
featured: false                                # true: larger card, shown on the home page
order: 4                                       # position on /projects (ascending)
---

The write-up, in Markdown.
```

Bright, high-contrast images with big shapes make the best ASCII art.

### A publication

Create `src/content/publications/<id>.md`:

```md
---
title: Paper title
authors: [First Author, Hasan Arikan, Third Author]   # your name is shown in bold
venue: Conference or journal name
year: 2026
url: https://doi.org/...                 # optional, the paper page
pdf: /papers/paper.pdf                   # optional: a URL or a file in public/
repo: https://github.com/Arikanhs/code   # the "Code" button
projectSlug: my-project                  # optional: id of a project; adds a "Project" button
tags: [HPC]
bibtex: |
  @inproceedings{key2026,
    title  = {Paper title},
    author = {Author, First and Arikan, Hasan},
    booktitle = {Conference},
    year   = {2026}
  }
---
```

### A blog post

Create `src/content/blog/<id>.md`:

```md
---
title: Post title
description: One sentence for the list, search results and the RSS feed.
date: 2026-11-01
tags: [machine learning]
draft: true   # visible with `npm run dev`, left out of the build and the feed
---

Write in Markdown. Math: $inline$ and $$display$$ (KaTeX). Code blocks are highlighted
and get a copy button. Posts with three or more `##`/`###` headings get a table of contents.
```

### Colors

Every color is a token in `src/styles/global.css`. The cream default is in `@theme`; the
home page and every tab have an `html[data-theme=...]` block below it (BaseLayout picks the
theme from the URL). Each theme is a left-to-right wash from
`--color-bg` to `--color-bg-end` plus one accent: `--color-accent` for fills and
`--color-accent-text`, its readable version, for text. Code blocks are colored from the
same tokens (`--code-*`), so they follow the page. After changing a color, `npm test`
checks the contrast of every pair, code included (`tests/e2e/themes.spec.ts`).

### The home background

The shapes the letters form are SVG paths in a 256 x 256 box, listed in order in
`src/components/ascii/shapes.ts` with the caption shown under each (in big pixel letters,
`pixel-font.ts`, where there is room); the animation cycles through them. Any filled
silhouette works (icon sets with a "fill" style are a good source; keep their license
notice in `licenses/`). What each shape does once formed is in
`src/components/ascii/acts.ts` (one small function per shape, in the shape's 256 x 256
box). Timing is set at the top of `src/components/ascii/morph.ts`
(`HOLD_MS` is how long each shape stays), and so are the hover ripple's size and speed
(`RIPPLE_*`); the colors come from the home theme's tokens.

### The resume

Edit `src/data/resume.yaml`, then run `npm run cv` so `public/cv.pdf` matches. The schema
rejects anything that looks like a phone number.

### Site details

Name, links, the home intro and the hero lines are in `src/lib/site.ts` (mirrors
"My details" in ROADMAP.md).

## Deploy

Every push to `main` builds and publishes the site with GitHub Actions
(`.github/workflows/deploy.yml`, using `withastro/action`). One-time setup:

1. Create a public repository named `Arikanhs.github.io`.
2. In it: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push `main`. The site appears at https://arikanhs.github.io.

`public/cv.pdf`, `public/og.png` and the icons are generated locally and committed; CI
only runs `astro build`.

## Privacy

The original resume is kept in `private/` (git-ignored, never published).
`npm run check:private` reads the phone number from that PDF at runtime and searches the
whole working tree, including `public/`, `dist/` and the text inside every PDF, for it and
for anything shaped like a street address. Run it before committing.

## Layout

```
src/
  components/ascii/   AsciiImage + its runtime, HeroAscii + morph (textmode.js / Canvas 2D)
  components/layout/  header, footer
  components/ui/      cards, grids, hero, palette, timeline, ...
  content/            projects, publications, blog (+ content.config.ts)
  data/resume.yaml
  layouts/  lib/  pages/  styles/
public/               cv.pdf, icons, og.png, robots.txt
scripts/              cv export, brand assets, covers, privacy check
tests/e2e/            Playwright + axe tests
licenses/             notices for third-party artwork (Phosphor Icons)
docs/                 build log, decisions, plans, owner TODO list
```
