Build my personal website end to end, autonomously, following ROADMAP.md and CLAUDE.md in this folder. Work through every stage, from the first unticked one to Stage 12, without stopping to ask me questions. I may be away from the computer.

## Before anything else
1. Save this entire prompt to docs/run-instructions.md. Re-read it at the start of every stage and after any context compaction.
2. Keep the computer awake for the whole run:
   - macOS: start `caffeinate -dims` as a background process and note its PID in docs/progress-log.md.
   - Windows: start a background PowerShell process that calls SetThreadExecutionState(0x80000003) every 60 seconds.
   Stop it when the run ends.
3. Create a branch named `autobuild` and do all work there. Commit locally. Never push, and never change GitHub settings.
4. Protect my resume (it is in this folder as a PDF or Word file):
   - Before the first commit, move the original into private/ and add private/ to .gitignore. If git history already contains it, stop and tell me. Do not rewrite history yourself.
   - My phone number and home address must not appear anywhere: site pages, data files, public/, generated PDFs, tests, logs, notes or scripts. Never write them into any file.
   - Before every commit, search the whole repo, including public/ and dist/, for them and fix any hit.
5. Fill "My details" in ROADMAP.md from the resume: name, email, GitHub, LinkedIn. Never the phone number or address. Draft the one-line intro from the resume. Anything you can't find gets a clear placeholder and a line in docs/TODO-for-me.md.

## Project structure
Keep the repo organized like this, creating folders when a stage first needs them:
- CLAUDE.md, ROADMAP.md, README.md at the root
- docs/: run-instructions.md, progress-log.md, decisions.md, TODO-for-me.md, plans/
- private/: original resume (git-ignored, never published)
- public/: cv.pdf, favicons, social preview image
- src/assets/projects/: cover images
- src/components/: ascii/, layout/, ui/
- src/content/: projects/, publications/, blog/ (plus src/content.config.ts)
- src/data/resume.yaml
- src/layouts/, src/lib/ (helpers), src/pages/, src/styles/
- tests/e2e/: Playwright and axe tests; tests/screenshots/ (git-ignored)
- scripts/: build helpers such as the CV export
- .github/workflows/deploy.yml

## Overrides for this run
These replace the matching rules in CLAUDE.md and ROADMAP.md for this run only. Don't edit CLAUDE.md to reflect them.
- Do all stages in this one run instead of one per session.
- "Plan first" stages: write the plan to docs/plans/stage-N.md, critique it against the stage spec, improve it, then implement without waiting for me.
- Dependencies: add what a stage genuinely needs without asking. Prefer small, well-maintained packages, and log each one with its reason in docs/decisions.md.
- Stage 2: create the workflow and config but don't push. Put the exact GitHub Pages setting I need to change in docs/TODO-for-me.md.
- Stage 8: build src/data/resume.yaml from my resume, without the phone number and address. Generate public/cv.pdf from the site's /resume page (for example with Playwright's print to PDF). Never copy the original file.
- "Done when" checks: verify them yourself with the checks below. List anything only I can confirm in docs/TODO-for-me.md.

## The loop for every stage
1. Re-read the stage in ROADMAP.md, plus CLAUDE.md and docs/progress-log.md.
2. Implement it. Use the frontend-design skill for all UI work.
3. Check:
   a. `npm run build` and `npx astro check` pass with no errors.
   b. All tests in tests/ pass. In Stage 0, set up Playwright with smoke tests (every page loads, no console errors, no broken internal links) and axe accessibility checks. Every later stage adds tests for its own features.
   c. Take Playwright screenshots of every page the stage touched, at 375px and 1280px wide, and look at them. Check layout, overflow, contrast and overlapping text, and that the feature looks the way the stage describes.
   d. Verify the stage's "Done when" line as far as tooling allows.
4. Review yourself. Read the stage's full diff as a strict senior reviewer would. Look for bugs, accessibility and performance problems, dead code, inconsistencies with earlier stages, and ways to make the visuals more striking without breaking the rules. Fix what you find and redo step 3. Do at most 3 review rounds, and log anything left over in docs/TODO-for-me.md.
5. Record. Append to docs/progress-log.md what you built, which checks ran and their results, issues found and fixed, and what's left. Add design and tech decisions to docs/decisions.md.
6. Run the phone/address search, tick the stage in ROADMAP.md, and commit with the message "stage N: <stage name>".
7. Go straight to the next stage. Don't stop to report between stages.

## After Stage 12
1. Do a final whole-site review: consistency across pages, every link, mobile layout, keyboard navigation, reduced motion, and Lighthouse if it can run here (aim for 90+ in every category on the home and projects pages). Fix issues and commit.
2. Write README.md: what the site is, how to run it, how to add a project, publication or blog post, and how to deploy.
3. Stop the keep-awake process.
4. Give me a final report: what was built in each stage, test results, Lighthouse scores, everything in docs/TODO-for-me.md, and the exact commands to merge autobuild into main and push.

## When to stop early
Stop and tell me only if:
- my resume is in git history,
- a step needs my accounts, passwords or payment, or
- a step would delete or overwrite files outside this folder.
For anything else, pick the most reasonable option, note it in docs/decisions.md, and keep going. If you hit a usage limit or the session ends, docs/progress-log.md must let a new session pick up exactly where you stopped.
