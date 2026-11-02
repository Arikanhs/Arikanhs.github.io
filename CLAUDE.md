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
- Dark terminal aesthetic, monospace accents, one accent color.
- Motion is purposeful, and everything respects prefers-reduced-motion.
- Use the frontend-design skill for all UI work.

## Rules
- One stage per session; change only what the stage asks for.
- Run npm run build before saying a task is done, and fix every error.
- Ask before adding a dependency, and say why it is needed.
- Accessibility: semantic HTML, alt text, keyboard reachable, WCAG AA contrast.
- Mobile first; check layouts at 375px wide.
