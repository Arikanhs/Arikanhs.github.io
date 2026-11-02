# Hasan Serdar Arikan: personal website

The personal site of Hasan Serdar Arikan, a master's student in machine learning, AI and
cybersecurity. Sections: projects (with colored ASCII art made from each project's
cover), publications (with code links and BibTeX), a blog (code, math, RSS) and a
resume (with a printable PDF).

Built with [Astro](https://astro.build) 7, TypeScript (strict) and Tailwind CSS 4.
The ASCII backgrounds use [textmode.js](https://code.textmode.art) (WebGL2) with a Canvas
2D fallback. Deployed to GitHub Pages.

## Run it

Requires Node.js 22.23 or newer (24 recommended).

```sh
npm install
npm run dev        # http://localhost:4321 (dev-only pages: /lab/ascii, /lab/cards)
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
tests (`ascii`, `cards`, `transitions`) use your installed Google Chrome, because
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
cover: ../../assets/projects/my-project.jpg    # source of the ASCII art
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
  components/ascii/   AsciiImage + its runtime (textmode.js / Canvas 2D)
  components/layout/  header, footer
  components/ui/      cards, grids, hero, palette, timeline, ...
  content/            projects, publications, blog (+ content.config.ts)
  data/resume.yaml
  layouts/  lib/  pages/  styles/
public/               cv.pdf, icons, og.png, robots.txt
scripts/              cv export, brand assets, covers, privacy check
tests/e2e/            Playwright + axe tests
docs/                 build log, decisions, plans, owner TODO list
```
