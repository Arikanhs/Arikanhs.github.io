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
- [ ] **Image2ASCII** (src/content/projects/image2ascii.md): there is no public repo at
      https://github.com/Arikanhs/Image2ASCII yet, so its link is a 404 until you publish it
      (or change `repo`). Also set the real date and write-up, and replace the generated
      cover with one of your own input images.
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
- [ ] Open the lab (`npm run dev`, then http://localhost:4321/lab/ascii) and confirm the
      colored ASCII looks like your Image2ASCII output. Tune the defaults in
      src/components/ascii/AsciiImage.astro (`characters`, `cellSize`, `normalize`).
- [ ] The WebGL tests (tests/e2e/ascii.spec.ts) use your installed Google Chrome, because
      Playwright's own headless Chromium has only software WebGL.
