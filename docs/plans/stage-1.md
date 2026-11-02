# Stage 1 plan: Design direction and layout

## Visual direction: "phosphor notebook"
A research notebook shown on an amber-phosphor terminal. Everything that is
*interface* (nav, labels, headings, tags, buttons, the hero) is set in monospace;
everything that is *reading* (summaries, project write-ups, posts) is set in a serif.
The serif nods to papers and publications, and the monospace to the terminal.

### Palette (dark terminal base, one accent)
| Token | Hex | Use | Contrast on bg |
|---|---|---|---|
| `bg` | `#0d0c0b` | page background (warm near-black, like a dark CRT) | |
| `surface` | `#151311` | cards, header | |
| `surface-2` | `#1d1a17` | hover / raised | |
| `line` | `#2c2824` | borders, rules | decorative |
| `fg` | `#ece6dc` | primary text (warm paper white) | 15.8:1 |
| `muted` | `#a39a8e` | secondary text | 7.0:1 |
| `faint` | `#8a8176` | dates, meta (small text allowed) | 5.1:1 (4.5:1 on surface-2) |
| `accent` | `#ffb000` | **the one accent**: amber phosphor; links, cursor, focus, selection | 10.7:1 |
| `accent-strong` | `#ffc94a` | hover state of the accent | |
| `accent-ink` | `#1a1100` | text on accent backgrounds | 10.2:1 on accent |

No other hues. Tailwind's default palette is removed (`--color-*: initial`) so only
these tokens exist as utilities (`bg-bg`, `text-muted`, `border-line`, `text-accent` …).

### Type pairing (self-hosted with Astro's Fonts API, Fontsource provider)
- **IBM Plex Mono** (400, 500, 600 + 400 italic) for interface and headings. Its
  IBM-terminal heritage suits the amber-phosphor theme and it stays readable at 13px.
- **Source Serif 4** (variable, 400–700, roman + italic, optical sizes) for reading.
  A sturdy text serif that holds up on dark backgrounds.
- Fallbacks: `ui-monospace, Menlo, monospace` and `Georgia, serif`; Astro generates
  metric-matched fallbacks to limit layout shift. Preload only the two upright faces.

### Spacing scale
- 4px base unit (Tailwind's default `--spacing: 0.25rem`); steps used: 4, 8, 12, 16,
  24, 32, 48, 64, 96, 128.
- Page gutter `clamp(1rem, 0.6rem + 1.8vw, 2rem)`; section rhythm
  `clamp(4rem, 3rem + 4vw, 7rem)`; page width 72rem; prose width 68ch (~70 chars).
- Type scale: 12 / 14 / 16 / 18 (body) / 20 / 24 / 32 and a fluid display size
  `clamp(2.25rem, 1.5rem + 3.2vw, 3.75rem)` for page titles.

### Signature detail: the phosphor cursor
Every page title reads like a shell prompt: a dim `~/path` line above the h1 and an
amber block cursor after it. The cursor blinks a few times on load, then rests
solid (under 5 s, so WCAG 2.2.2 needs no pause control; static under reduced
motion). The same block marks the current page in the nav and will be the caret of
the terminal hero in Stage 7. Selection and focus use the same inverted-amber look.

Background: a faint dot grid ("graph paper") with a very soft amber glow at the
top of the page. Both are CSS gradients, so they cost nothing to load.

## Implementation
1. `astro.config.mjs`: `fonts` for the two families (`--font-plex-mono`, `--font-source-serif`).
2. `src/styles/global.css`: `@theme` tokens (colors, fonts, sizes), base styles
   (color-scheme dark, selection, focus-visible ring, links, scroll padding for the
   sticky header), a `container-page` utility, the cursor, a reduced-motion safety net.
3. `src/lib/site.ts`: name, links and nav items (mirrors "My details").
4. `src/components/layout/SiteHeader.astro`: sticky header, wordmark, one `<nav>`
   with the five links (`aria-current="page"` on the active one). Mobile (<768px):
   a disclosure button (`aria-expanded`, `aria-controls`) shows/hides the list;
   Esc closes and returns focus to the button; it also closes on link click and when
   the viewport grows past the breakpoint. Without JS the list simply wraps
   (the button stays hidden), so the site works with JavaScript off.
5. `src/components/layout/SiteFooter.astro`: terminal-style "contact" block with GitHub,
   LinkedIn and email from "My details", plus a copyright line.
6. `src/components/ui/PageHeader.astro`: eyebrow path (aria-hidden), h1, cursor
   (aria-hidden), optional lede.
7. `BaseLayout.astro`: head (fonts, meta, theme-color), skip link to `#main`, header,
   `<main id="main" tabindex="-1">`, footer. Applied to all five pages.
8. CLAUDE.md "Design direction": add palette and fonts.
9. Tests `tests/e2e/nav.spec.ts`: desktop links and `aria-current`; mobile menu
   open/close by mouse and keyboard, Esc returns focus; Tab reaches every link at
   1280px and at 375px (menu open); skip link is first and moves focus to main;
   footer links match "My details".

## Critique against the stage spec, and changes made
- Spec asks for *one* accent and a mono + readable body pairing: met. Risk: serif
  body at small sizes on dark backgrounds → body text is at least 18px for prose and
  16px elsewhere, line-height 1.65, and the faint token was raised from `#6f675d`
  (3.5:1, fails AA) to `#8a8176` so even small meta text passes AA.
- "Mobile nav that works with the keyboard": a disclosure (not a modal) is the WAI
  pattern for site nav and avoids a focus trap; added Esc handling and 44px targets.
- Sticky header could hide the skip-link target and anchors → `scroll-padding-top`.
- Blinking cursor could violate WCAG 2.2.2 → finite blink (4 × 1.1 s), then solid.
- Decorative `~/path` eyebrow would be read aloud as "tilde slash" → aria-hidden.
- Stage 6 adds client-side navigation, so the nav script is written as an `init()`
  that is safe to run more than once. Stage 6 will hook it to `astro:page-load`.
- Fonts add weight → only upright faces preloaded; four font files in total.
