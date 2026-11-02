# Build roadmap

How to use: start a new Claude session for each stage and say
"Do Stage N from ROADMAP.md." When the "Done when" check passes, commit,
and ask Claude to tick the stage below.

## My details
Fill these in once; stages refer to them.

- Name: Hasan Serdar Arikan
- GitHub username: Arikanhs
- One-line intro for the home page: Master's student in ML, AI and cybersecurity at UNLV and NSF CyberCorps scholar, with research on GPU graph algorithms at Berkeley Lab.
- Email: Arikan@unlv.nevada.edu
- LinkedIn URL: https://www.linkedin.com/in/hasan-serdar-arikan-698740198/

## Progress
- [x] Stage 0: Scaffold
- [x] Stage 1: Design direction and layout
- [x] Stage 2: Deploy early
- [x] Stage 3: Content model
- [x] Stage 4: ASCII lab
- [x] Stage 5: Projects section with ASCII cards
- [x] Stage 6: Project pages and view transitions
- [x] Stage 7: Terminal hero
- [x] Stage 8: Resume
- [x] Stage 9: Publications
- [x] Stage 10: Blog
- [ ] Stage 11: Command palette and motion polish
- [ ] Stage 12: Launch polish

---

## Stage 0: Scaffold

Set up this repo as an Astro site in the current folder. The folder already
contains CLAUDE.md and ROADMAP.md; keep both unchanged.

- Use the latest stable Astro with TypeScript (strict) and Tailwind CSS, following the current Astro docs.
- Create placeholder pages: / (home), /projects, /publications, /blog, /resume, each with just a heading.
- Add a .gitignore for Node and Astro.
- Run npm run build and fix any errors. Then tell me the command to start the dev server.

**Done when:** `npm run dev` shows all five pages and the build passes.

## Stage 1: Design direction and layout

**Plan first.** Use the frontend-design skill. Before writing any code, propose a
visual direction in a few lines: palette (dark terminal base, one accent color),
type pairing (a monospace for accents and a readable face for body text),
spacing scale, and one signature detail. Wait for my OK.

After I approve:
- Put the design tokens in Tailwind / CSS variables.
- Build a BaseLayout with header nav (Home, Projects, Publications, Blog, Resume), a footer with GitHub, LinkedIn and email links from "My details", and a skip-to-content link.
- Add a mobile nav that works with the keyboard.
- Apply the layout to all five pages.
- Add the chosen palette and fonts to the "Design direction" section of CLAUDE.md.

**Done when:** the nav works on desktop and at 375px wide, and the Tab key reaches every link.

## Stage 2: Deploy early

Set up deployment to GitHub Pages.

- Add .github/workflows/deploy.yml using withastro/action and actions/deploy-pages, triggered on push to main and manually.
- Set `site` in astro.config to https://<GitHub username>.github.io, using the username from "My details".
- Tell me exactly which setting to change under the repo's Settings > Pages.

**Done when:** a push to `main` publishes the site at the github.io address.

## Stage 3: Content model

Set up content collections in src/content.config.ts with Zod schemas:

- projects: title, summary, date, tags[], repo (GitHub URL), demo (optional URL), cover (image used for the ASCII background), featured (boolean), order (number).
- publications: title, authors[], venue, year, url (optional), pdf (optional), repo (GitHub URL of the matching code), projectSlug (optional, links to a project entry), tags[], bibtex (string).
- blog: title, description, date, tags[], draft (boolean).

Add 3 sample projects (one is my Image2ASCII C++ project), 2 sample publications
and 2 sample blog posts with clear placeholder text. Put sample cover images in
src/assets/projects/.

List the projects on /projects as a plain grid for now: title, summary, tags,
repo link. No ASCII yet.

**Done when:** /projects lists 3 cards, and deleting a required field from an entry makes the build fail.

## Stage 4: ASCII lab

**Plan first.** Build the ASCII background component in isolation before using
it anywhere. First read the textmode.js docs at https://code.textmode.art:
loading images, character sets, cell color modes, sizing, and cleanup. Install
textmode.js pinned to an exact version. Propose your approach and wait for my OK.

Then:
- Create src/components/AsciiImage.astro. Given an image, it renders colored ASCII that fills its parent box, each character taking the sampled pixel color. Props: src, characters (default " .:-=+*#%@"), cell size, background color.
- Load textmode.js only in the browser, and only when the component is near the viewport.
- Fallback: if WebGL2 is unavailable or prefers-reduced-motion is set, draw a static version with a small Canvas 2D function (downsample, map brightness to a character, fill it with the pixel color).
- Release the WebGL context when the component leaves the page.
- Make a dev-only page /lab/ascii that shows the component on the sample covers, with a slider for cell size and a text box for the character set.

**Done when:** /lab/ascii shows colored ASCII that looks like my Image2ASCII output, and emulating reduced motion in Chrome DevTools (Rendering panel) shows the static fallback.

## Stage 5: Projects section with ASCII cards

**Plan first.** Use the frontend-design skill. Upgrade the /projects grid so each
card uses AsciiImage as its background, built from the project's cover image.

- Readable text: a scrim behind the title and summary; text must pass WCAG AA contrast.
- Hover and keyboard focus: the ASCII starts as random characters and resolves into the image in about 600ms; on leave it dissolves softly.
- Performance: only cards on screen run a live WebGL instance; off-screen cards show a static snapshot. Keep live instances to a handful at most.
- Featured projects get a larger card. Sort by `order`.
- Also show featured projects on the home page in a "Selected work" strip.

**Done when:** with the sample entries duplicated to 10 cards, scrolling stays smooth and the browser console shows no WebGL context warnings.

## Stage 6: Project pages and view transitions

Add a detail page for each project at /projects/[slug], rendered from the
project's Markdown body.

- The header reuses the ASCII background and shows title, tags, repo and demo buttons, plus related publications (those whose projectSlug matches).
- Enable Astro view transitions site-wide with `<ClientRouter />`. Give the card and the detail header the same `transition:name` so the card morphs into the page header.
- Make sure AsciiImage and every other script re-initialize after client-side navigation.
- Respect prefers-reduced-motion.

**Done when:** a card morphs into its page and Back morphs it back, and ASCII still renders after several navigations.

## Stage 7: Terminal hero

Use the frontend-design skill. Build the home page hero as a terminal window:

- A prompt line that types `whoami`, then the one-line intro from "My details".
- Below it, three short lines styled as command output: focus areas (ML, AI, security), current status, and links (GitHub, email, CV).
- A blinking cursor. Typing runs once per visit; with reduced motion the final text shows immediately.
- The text must be in the HTML for screen readers and search engines before any animation runs.

**Done when:** the hero looks right at 375px wide and with JavaScript turned off.

## Stage 8: Resume

Build /resume from one data file (src/data/resume.yaml): education, experience,
skills grouped by area, and awards, plus a "Download PDF" button pointing to
public/cv.pdf.

- Show education and experience as a timeline.
- Add a print stylesheet so the page prints cleanly on A4 and Letter.
- Use clear placeholders; I'll fill in the real data.

**Done when:** the page reads well on screen and its print preview fits cleanly.

## Stage 9: Publications

Build /publications from the publications collection.

- Group by year, newest first. Each entry shows title, authors (my name from "My details" in bold), venue, and buttons for PDF, Code (the GitHub repo) and Project (when projectSlug is set).
- A "Copy BibTeX" button that copies the entry and confirms with a short toast.
- Filter chips by tag, if it stays simple.

**Done when:** every Code button opens the right repo and Copy BibTeX pastes valid BibTeX.

## Stage 10: Blog

Build the blog from the blog collection. Ask before adding any dependency.

- /blog lists posts newest first with date, reading time and tags; drafts are hidden in production builds.
- Post layout: about 70 characters per line, a table of contents for long posts, syntax-highlighted code blocks with a copy button, and math rendering (I'll write about ML).
- Tag pages at /blog/tags/[tag] and an RSS feed at /rss.xml.

**Done when:** a sample post with a code block and a formula renders correctly and /rss.xml loads.

## Stage 11: Command palette and motion polish

Use the frontend-design skill. Keep it lightweight; justify any new dependency.

- Add a command palette opened with Ctrl+K / Cmd+K and a visible header button: fuzzy search over pages, projects, publications and posts; arrow keys and Enter to navigate; Esc to close; focus stays inside while it is open.
- Add subtle scroll-reveal animations to section headings and cards using IntersectionObserver and CSS, turned off under prefers-reduced-motion.

**Done when:** I can reach any project using only the keyboard through the palette.

## Stage 12: Launch polish

Prepare the site for launch:

- Per-page title, description, canonical URL, and Open Graph tags, plus a default social preview image in the site's style.
- Sitemap, robots.txt and a favicon set.
- A 404 page in the terminal style.
- An accessibility and performance pass: list the issues you find, fix them, and report what changed.

**Done when:** Lighthouse in Chrome DevTools scores 90 or higher in every category on the home and projects pages.

---

## Adding features after launch

Add a new stage at the end of this file in the same shape, then ask for it by number:

```
## Stage N: <name>
**Plan first.** (keep for anything bigger than a small fix)
Goal: ...
Constraints: ...
**Done when:** ...
```
