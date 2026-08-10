# Working in this repo

This is a single static file. `index.html` contains all markup, styles and script —
no build step, no package manager, no framework, no backend. Don't introduce one
without being asked.

## Before changing the nav or the glass

Read `README.md` first, then the `generateLensMap()` and `spring()` functions.

- The tab bar's highlight is a real `feDisplacementMap` filter. Do not replace it
  with `backdrop-filter` — the refraction is the point of the design.
- Nav geometry is **measured**, never computed from division math: flexbox rounds
  item widths independently, so arithmetic drifts a pixel or two. Read the tab rects.
- Measure against `#refractlayer`, not `#tabbar`. It's the filter's reference box,
  so it's the only origin where the pill, the lens map and the icons agree.
- One DOM serves both the bottom tab bar and the left rail. Keep it axis-agnostic —
  pass `x`, `y`, `w` and `h` through, don't assume horizontal travel.
- Regenerate the lens map whenever the pill's dimensions change, including breakpoint
  crossings. It's cached by size, so calling it freely is cheap.

## Layout

Two breakpoints: 768px moves navigation to a left rail, 1024px gives that rail
labels. Prefer `clamp()` for type and spacing over new breakpoints — the design is
meant to ramp continuously, not step.

Percentage padding inside `.view` resolves against the app shell, not the view's own
box, so `--rail-w` has to be subtracted explicitly in the centring calculation.
This is easy to get wrong and looks almost right when you do.

## Haptics

`navigator.vibrate` only, always feature-detected, wrapped in try/catch. 10ms for
selection, 18ms for consequential confirmation, nothing for passive or read-only
interaction. Don't add a buzz to scrolling or row taps.

## Verifying

There's no test runner. Changes to layout, the lens or the haptics should be checked
in a real browser at phone, landscape-phone, 768px and 1024px+ widths — the lens
alignment and the sheet's height cap are the things that break silently.
