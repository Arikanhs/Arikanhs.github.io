# TODO for me

Things only you can do or confirm. Grouped by topic; each line says where to change it.

## My details
- [ ] Confirm the GitHub username `Arikanhs` (taken from the GitHub CLI login on this
      machine, not from the resume). It drives the site URL and every repo link.
- [ ] Review the one-line intro drafted from your resume (ROADMAP.md "My details").

## Deploy (Stage 2)
- [ ] Create a **public** GitHub repository named exactly `Arikanhs.github.io` (empty: no
      README, license or .gitignore). A repo with that name is a "user site", served at
      https://arikanhs.github.io with no base path, which is what astro.config.mjs expects.
      (Any other repo name serves the site under /<repo>/ and would need `base` set plus
      base-aware links; that is not set up.)
- [ ] In that repository: **Settings → Pages → Build and deployment → Source → "GitHub Actions"**.
      This is the only Pages setting to change. (The default, "Deploy from a branch",
      would ignore the workflow.)
- [ ] Merge `autobuild` into `main` and push (exact commands are in the final report).
- [ ] Confirm the Stage 2 "Done when": the Actions tab shows "Deploy to GitHub Pages"
      succeeded and https://arikanhs.github.io loads the site.

## Content (Stage 3)
Search for "Placeholder" in src/content/ to find every spot.
- [ ] Confirm the code repos matched to your papers: `ml_cuda` for the HPEC 2025 GCN/CUDA
      paper and `Graph-Algorithms-LBNL` for the IPDPSW 2024 Kokkos paper. Both READMEs and
      your resume point that way. Set the real project dates.
- [ ] Publications: replace "et al." with the full author lists and paste the official
      BibTeX from IEEE Xplore (adds DOI and pages). Add `pdf:` links if you can share them.
- [ ] Project covers in src/assets/projects/ are generated samples
      (`node scripts/make-covers.mjs`); swap in real images whenever you like.
- [ ] The two blog posts are labelled samples; replace or delete them.
- [ ] More projects you could add from your resume and GitHub: Peak Focus (team repo
      hetavigheewala/CS472-Gamified-Productivity), the AlphaFold data pipeline
      (Alpha-Fold-LBNL), NREL energy forecasting (ML-NREL), gov_job_finder.

## ASCII (Stage 4)
- [ ] Open the lab (`npm run dev`, then http://localhost:4321/lab/ascii) and confirm you like
      the colored ASCII on the project covers. Tune the defaults in
      src/components/ascii/AsciiImage.astro (`characters`, `cellSize`, `normalize`).
- [ ] The WebGL tests (tests/e2e/ascii.spec.ts) use your installed Google Chrome, because
      Playwright's own headless Chromium has only software WebGL.

## Home background (after the run)
- [ ] Watch the animation (bird, detective, robot, chip; 5 s each, each with its own act) and say what to change: the shapes
      (src/components/ascii/shapes.ts), hold time (top of src/components/ascii/morph.ts),
      colors (the home theme in src/styles/global.css), or the letter size (`cellSize`
      in morph.ts).

## Home hero (Stage 7)
- [ ] Check the hero's "focus" and "status" lines (src/lib/site.ts, `focus` and `status`).

## Resume (Stage 8)
- [ ] Review src/data/resume.yaml: wording, the skill groups (reorganized from your resume
      plus tools named in your experience bullets), and whether you want "U.S. citizen" and
      the GPA public. Then run `npm run cv` to regenerate public/cv.pdf and commit it.
- [ ] Print /resume from your browser once (A4 or Letter) to confirm you like the layout.

## Launch (Stage 12)
- [ ] Run Lighthouse once in your own Chrome DevTools on the live site (home and
      /projects/); the automated run here scored 98/100/100/100 on both.
- [ ] Look at public/og.png (the social preview) and the favicon; regenerate with
      `npm run assets` if you change your name or intro.

## Page themes (after the run)
- [ ] Look at Home, Projects and Publications on your phone and laptop and say if any color
      should be stronger or softer (src/styles/global.css, the html[data-theme] blocks).
- [ ] Blog is deep violet into black with amber (you asked for black; amber is my pick for the
      small color). Say if you want the tropical mint from Resume there instead.
- [ ] Hover over the home animation and say if the ripple should be bigger, slower or calmer
      (`RIPPLE_*` at the top of src/components/ascii/morph.ts).
- [ ] Captions under the home animation: bird "Freedom", robot "Artificial Intelligence" and
      chip "Technology" are yours; the detective's "Cybersecurity" is a placeholder. Change
      any of them in src/components/ascii/shapes.ts (`caption`).
