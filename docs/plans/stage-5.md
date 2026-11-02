# Stage 5 plan: Projects section with ASCII cards

## Card design
- The whole card is the ASCII image of the project's cover (AsciiImage, absolute fill),
  with the text in a panel at the bottom on a scrim: a gradient from transparent into
  `bg` at 90% opacity under the text. Worst case (pure white glyphs under the scrim):
  fg 12.7:1, muted 5.6:1, so title, summary, tags and links use fg/muted only (faint
  would drop to 3.8:1).
- At rest the ASCII layer sits at 70% opacity so the cards read as a calm grid. Hover or
  keyboard focus inside the card (`:focus-within`) brings it to full strength.
- Featured projects: span two columns from 768px up and are taller. Sorted by `order`.
- Home: a "Selected work" section with the featured cards and a link to all projects.

## The effect (live cards only)
- Enter (pointerenter / focusin): every cell starts as a random glyph and cells settle
  into the image in a random order over 600 ms (eased), while the layer fades to 100%.
- Leave (pointerleave / focusout): a soft dissolve: a sparse scatter of cells (peaking at
  about a third, mid-way) flickers to random glyphs and settles back over 450 ms while
  the layer fades back to 55%.
- How: textmode draws the converted image as before, then the unsettled cells are
  overdrawn with a random glyph on an opaque cell, using a per-cell color grid sampled
  on the CPU from the prepared image (same sampler as the static fallback). Frames are
  driven by requestAnimationFrame + `redraw()` only while an effect runs; when it ends,
  the frame is exactly the converted image again (no jump). Cell positions use the grid
  mapping measured in textmode: column offset `ceil(cols/2) - 1`, row offset `floor(rows/2)`.
- Static cards (reduced motion, no WebGL2, off-screen) only change opacity; under reduced
  motion the global rule removes that transition too.

## Performance
- Two visibility levels: near the viewport (300px margin) → draw the static snapshot;
  actually on screen → go live. Going live waits 150 ms so a fast scroll does not create
  and destroy contexts; leaving the screen releases the context after 600 ms.
- Hard cap of 6 live instances. Extra on-screen cards wait in a queue and take a slot
  when one frees up.
- The static snapshot is the existing Canvas 2D layer, so an off-screen card looks the
  same as a resting live one.

## Done-when test
A dev-only `/lab/cards` page renders the project grid with the sample entries repeated to
10 cards. In Chrome with a GPU: scroll down and back in steps; at every step at most 6
contexts are live and no off-screen card is live; the console has no warnings (in
particular no "Too many active WebGL contexts"); frame times during a smooth scroll stay
low (95th percentile under 50 ms). Plus: hover and keyboard focus run the effect and end
on exactly the resting frame; reduced motion runs no effect.

## Critique against the spec, and changes made
- "Starts as random characters": the rest state shows the image (dimmed), and the
  random-to-image resolve plays on hover/focus, so the cards are informative before any
  interaction and the effect still matches the wording.
- Keyboard: Stage 5 cards have one focusable element (the repo link); `:focus-within`
  and `focusin` cover it. Stage 6 adds the title link to the detail page.
- Contrast over a canvas cannot be measured by axe, so the scrim opacity is chosen for
  the worst case (white glyphs) and documented above.
- Many hover effects at once: each card has its own effect; only live cards run frames,
  and the cap keeps that to 6.
