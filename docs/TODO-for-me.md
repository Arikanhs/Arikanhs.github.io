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
