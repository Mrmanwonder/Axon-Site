# Social visual foundations (AXO-84)

Derived from the shipped Axon UI, not from a mood board: `src/ui/styles/tokens.css`, `system.css`, `public/axon-logo.svg`, `public/axon-lockup-v2.svg`, the Onest variable subset (`public/fonts/onest-latin-var.woff2`) and the rules in `CLAUDE.md` (Design language). Where this document and `tokens.css` disagree, `tokens.css` wins.

Everything below is reproducible: `node docs/claude/social/tools/build.mjs` regenerates the templates, examples, phone-size previews and the contrast table from the real tokens and the real font.

Status: **specification and templates complete; approval is a human step** (the AXO-84 packet says "checked and approved"). See "Open for approval" at the end.

## 1. What Axon looks like (the source of truth)

- **Flat, dark-first.** Background `#000`, cards `#151517`, hairlines at 7.5% white. Light theme is `#F4F4F7` with white cards and a soft shadow. No gradients on surfaces; the only "glow" in the product is a low-alpha blue wash (`rgba(58,134,255,.26)`).
- **One accent.** Blue (`#3A86FF` dark / `#2C74E8` light) is the only thing that draws the eye forward. Amber is "needs attention". Green is "confirmed/positive". **Red is reserved** — in the product only for signing out; in the scans it is the teacher's pen.
- **Seven cause hues**, equal visual weight, fixed, theme-independent, never a severity ramp: conceptual_gap `#4C7DF0`, procedural_slip `#3FA9A0`, misread_question `#8A6FD1`, incomplete `#C98A3E`, presentation `#C46B8A`, keyword_miss `#7C9455`, timed_out `#78808F`.
- **Confidence is form, not colour:** confirmed = solid, likely = light fill + border, unsure = dashed outline.
- **Type:** Onest, set tight (negative tracking throughout: h1 `-0.036em`), tabular numerals, never a mark above 28px.
- **Motion:** transform/opacity only; 120 / 200 / 320 ms.
- **Voice of the surface:** "marks lost", never "score"; no exclamation marks; no streaks, badges or gamified progress; sample sizes on every headline insight.

## 2. Layout and grid

The app is a single column at ~390 px with an 18 px gutter (text gutter 22 px) and 24 px card radius. Social scales that by **1080 / 390 = 2.77** and rounds to the 8-pt grid.

| Canvas | Size | Use | Safe margin | Notes |
|---|---|---|---|---|
| Feed portrait (primary) | 1080 × 1350 (4:5) | single posts, carousels | 64 px all sides | 64 ≈ 22 px × 2.77 (the app's text gutter) |
| Square | 1080 × 1080 (1:1) | quick single insights | 64 px | |
| Story / reel cover | 1080 × 1920 (9:16) | stories, reel covers | 64 px sides; **250 px top, 340 px bottom** kept clear of text | Conservative figures for platform UI overlays; confirm against each platform's current guidance before the first story is published |
| Link card | 1200 × 630 | OG/link previews | 48 px | text is scaled up (see §3) so it still reads at ~390 px |

Rules
1. **One column, left-aligned** at the 64 px margin. No centred paragraphs. Headline starts at ~31% of height on 4:5 (the app's `--view-top` rhythm), leaving the top band for the eyebrow and index.
2. **Carousels:** every slide uses the same margins, the same eyebrow position (top-left) and the same index (`n / N`, top-right). The footer (`axonstudy.online`) sits on the bottom margin of every slide. Continuity is positional: the headline baseline of slide *n* is the same as slide *n+1* unless the slide is a screenshot slide.
3. **Max four headline lines, three on story.** One idea per slide.
4. **Dot field motif** (see §6) is the only decoration; it is identical on every slide, so it reads as a texture, not content.

## 3. Typography

Sizes are the in-app scale × 2.77, so social reads like the product at a larger zoom.

| Role | Social px (1080 wide) | In-app source | Weight / tracking | Max line length |
|---|---|---|---|---|
| Headline | 96 (line height 1.06) | `--fs-h1` 34 | 600 / `-0.036em` | ~14 characters per line, 4 lines |
| Sub | 40–48 | `--fs-insight` 21 → 58, `--fs-t1` 15.5 → 43 | 450 / `-0.01em` | ~32 characters per line, 3 lines |
| Meta / eyebrow / footer | **32 minimum** | `--fs-chip` 11.5 → 32 | 500–650, eyebrow tracked `+0.08em` uppercase | one line |
| Link-card text | 40 minimum | scaled ×1.25 for 1200 px canvas | | |

- **Smallest allowed text = 32 px on a 1080 canvas = 11.6 px at 390 px display, at or above the smallest size the app itself uses (`--fs-tier` 11 px).** Nothing smaller, including footnotes. If it doesn't fit at 32 px, it doesn't belong on the slide — it goes in the caption.
- **Marks are never set large.** Even on social, a mark or number is ≤ the sub size; a big number reads as a verdict (CLAUDE.md).
- Tabular numerals for anything numeric (`font-variant-numeric: tabular-nums`).
- Emphasis = weight and size only. No underline, no all-caps headlines, no emoji as punctuation.

### Contrast (computed from the tokens, WCAG 2.x)

| Pair | Dark `#000` | Light `#F4F4F7` |
|---|---:|---:|
| `label` on bg | 19.29 | 17.78 |
| `label-2` on bg | 6.36 | **4.05 (fails AA for text)** |
| accent on bg | 6.03 | **4.01 (fails AA for text)** |
| attention (amber) on bg | 10.22 | **3.08 (fails)** |
| cause hues on bg | 5.28 – 7.39 | 2.59 – 3.63 (never as text) |

Consequences, enforced in the templates:
- **Light variants use `label` for all text**; hierarchy comes from size and weight, not from `label-2`. The eyebrow is `label`, not accent, in light.
- Accent/amber text only on dark, or at ≥ 24 px bold (large-text rule) in light.
- Cause hues are fills and dots, **never text colour**, in light.
- Dark is the default for every format; light is the exception (insight squares).

## 4. Logo

Use the supplied files unmodified: `axon-logo.svg` (mark tile) and `axon-lockup-v2.svg/png` (lockup). They are black artwork on a white tile; **do not recolour, outline, add glows or build a "dark" variant** — on dark layouts the white tile is placed as a card.
- **Clear space:** ½ the mark's height on every side.
- **Minimum size:** mark 96 px, lockup 240 px wide on a 1080 canvas.
- **Placement:** footer-right or the closing slide only; never over a screenshot, never in the top-left (that slot is the eyebrow). Max once per slide; closing slide may use the lockup at 320–480 px.
- The wordmark in the footer is plain Onest text `axonstudy.online`, not a logo.

## 5. Colour and gradient

- Background: flat `#000` (dark) or `#F4F4F7` (light). **No gradient fills on backgrounds.**
- **One glow per slide**, optional: a radial wash from `rgba(58,134,255,.26)` to transparent, centred in the top-right quadrant, radius ≈ 60% of width. It is a focal hint, not a background. Not on light.
- Accent blue marks the single most important word/element. Amber marks "attention" (e.g. a flagged reading). Green only for "confirmed".
- **Red appears only as a teacher's pen on a depicted paper** (see board). Never as a badge, underline, alert, error, "wrong" mark or button, and never as a ✗.
- Cause colours are used only when the slide is about causes, in enum order, equal size — never sorted by magnitude, never a ramp.

## 6. Graphic language

Allowed motifs (all derived from product vocabulary):
1. **Fine-dot field:** 2 px dots on a 36 px pitch at ~14% label colour (see templates). The only background decoration.
2. **The X mark's geometry** as a very large, cropped, low-contrast element (≤ 8% opacity) on closing slides.
3. **Diagrammatic lines:** 2 px hairlines connecting a *real* source crop to its reading ("source → reading → explanation"), because that is what the product actually does.
4. **Cause dots:** the seven hues as 34 px dots with labels.

**Banned** (each appears dashed on the reference board): glowing brains, circuit-board/neural-net imagery, robots and chatbot avatars, floating holograms and "AI orbs", neon violet→cyan mesh gradients, stock gradients, 3D chrome shapes, ✨ as an AI signal, binary/matrix rain, percentage rings and giant scores, alert badges, streaks, confetti, leaderboards or rank/compare visuals, grade predictions.

## 7. Product screenshot treatment

- **Show the real UI.** Capture from the running app at 390 × 844, DPR 3 (1170 × 2532), dark theme by default, with **synthetic data** (invented student "Sam", invented question text; never a real student, real paper, or real exam content). Mark the example as such on the slide ("Illustrative example · not a real paper") using the dashed-outline tag in the template.
- **Crop:** either the whole screen, or one component, cropped on a card edge. Never crop mid-card.
- **Frame:** 40 px radius, 2 px `--hairline` border, no phone bezel, no tilt, no drop shadow in dark. Light gets the app's own card shadow.
- **Scale:** the phone UI occupies ≥ 60% of slide width so in-app text is ≥ 11 px at 390 px display. If it cannot, show one component larger instead of the whole screen.
- **No fake UI.** Nothing drawn to look like a product screen that the product does not have. If a feature is not shipped, there is no screenshot of it.
- Teacher ink in a screenshot is real red pen from a synthetic scan; that is the one place red may appear.

## 8. Reference board

`docs/claude/social/examples/reference-board.png` (source `reference-board.svg`): four acceptable and four unacceptable specimens built from the same tokens.

## 9. Files

```
docs/claude/social/
  tools/build.mjs                      regenerates everything below
  templates/tpl-*.svg|png|.phone390.png    5 editable layouts (4:5 dark, 4:5 light, 1:1, 9:16, link card)
  examples/*.svg|png|.phone390.png         6 example slides + reference board
```

## Open for approval (human)

- Approve the five layouts and the reference board (AXO-84 says "approved").
- Confirm platform safe-zone figures for stories/reels against current platform guidance before the first story.
- Confirm the logo rule that dark layouts use the supplied white-tile files unmodified (no dark logo exists; creating one is a brand decision, not made here).
