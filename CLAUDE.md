# Personal website

## Who and what
- Owner: master's student in ML, AI and cybersecurity.
- Sections: Resume, Projects, Publications (each links to its GitHub repo), Blog.

## How we work
- The build plan is in ROADMAP.md. Work only on the stage I name, and read that stage in full before starting.
- If a stage says **Plan first**, propose your approach and wait for my OK before editing files.
- When I confirm a stage's "Done when" check, tick that stage in the Progress list of ROADMAP.md.
- My personal details (name, GitHub username, intro line, links) are in the "My details" section of ROADMAP.md.

## Stack
- Astro (latest stable), TypeScript strict, Tailwind CSS.
- Content lives in src/content/ as content collections: projects, publications, blog.
- ASCII backgrounds use textmode.js at a pinned exact version. Its API is pre-1.0:
  read https://code.textmode.art before changing any ASCII code.
- Deploy: GitHub Pages via withastro/action on every push to main.

## Design direction
- Terminal aesthetic, monospace accents, one accent color per page theme.
- Palette (tokens in src/styles/global.css). Default (the 404 page) is soft cream paper:
  bg #f5efe3, surface #fbf8f1, surface-2 #ede5d6, line #d9cdb8, fg #2b241d, muted #5e5449,
  faint #6f6458; accent burnt amber #925300 (hover #7a4500, text on amber #fffaf0).
- Page themes (html data-theme, set by BaseLayout): a left-to-right wash plus one accent.
  - Home: sapphire #0f52ba into ocean blue #035e8c, a bit of neon jade #3bf5b0.
  - Projects: sky blue #87ceeb into cloudy white #f3f6f9, a bit of amber red #d33a1c.
  - Publications: red orange #ff5349 into snowy white #fffafa, a bit of punk yellow #ffe11a.
  - Resume: onyx black #141416 into electric indigo #6f00ff, a bit of tropical mint #8ef5cf.
    It still prints black on white (the CV PDF).
  - Blog: deep violet #2a0a6b into black #09090b, a bit of amber #ffb224.
- The accent is for fills; --color-accent-text is its AA version for text, link hovers and
  focus rings. No other hues; tests/e2e/themes.spec.ts checks every pair's contrast.
- Code blocks take their colors from the page's tokens (--code-* in global.css).
- Colors come from these tokens only; the ASCII art reads them at run time.
- Fonts (self-hosted with Astro's Fonts API): IBM Plex Mono for interface and headings,
  Source Serif 4 for reading text.
- Signature detail: the amber block cursor after page titles, also marking the current nav item.
- Motion is purposeful, and everything respects prefers-reduced-motion.
- Use the frontend-design skill for all UI work.

## Rules
- One stage per session; change only what the stage asks for.
- Run npm run build before saying a task is done, and fix every error.
- Ask before adding a dependency, and say why it is needed.
- Accessibility: semantic HTML, alt text, keyboard reachable, WCAG AA contrast.
- Mobile first; check layouts at 375px wide.
