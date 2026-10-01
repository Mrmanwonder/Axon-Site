# Mobile legibility, caption voice and asset organization (AXO-86)

Depends on AXO-84 (foundations) and AXO-85 (formats). Regenerate every number here with `node docs/claude/social/tools/build.mjs`.

## 1. Mobile feed legibility — measured

Method: each slide is rendered from its SVG with the real Onest font, then re-rendered **at 390 CSS px wide, DPR 3** (the width a phone feed shows; `*.phone390.png` next to every template/example). Smallest text is `font-size × (390 / canvas width)`. Contrast is computed from `tokens.css` values (WCAG 2.x).

| Slide | Canvas | Smallest text on a 390 px display | Verdict |
|---|---|---:|---|
| Portrait 4:5 dark/light, square, story, all examples | 1080 wide | **11.6 px** | At or above the app's smallest size (`--fs-chip` 11.5, `--fs-tier` 11). Only the eyebrow, index and footer are this small; headline renders at 34.7 px and sub at 14.4–17.3 px |
| Link card | 1200 wide | **13.0 px** | text scaled up for this canvas |
| Reference board | internal tool | n/a | not a feed asset |

Contrast: dark passes AA for every text role (label 19.3:1, label-2 6.4:1, accent 6.0:1, amber 10.2:1). **Light fails AA for `label-2` (4.05:1), accent (4.01:1) and amber (3.08:1) as normal-size text**, so light templates use `label` (17.8:1) for all text — verified in the generator, not just stated. Cause hues are never used as text.

First-slide comprehension (read the phone-size PNG of each cover without context):
- Post 1 "See where your marks went." — says what it is and for whom; passes.
- Post 4 "Your answer is right. The mark went for…" — the ellipsis forces slide 2; passes as a hook and is complete as a sentence once swiped. Risk: someone who doesn't swipe reads a cliffhanger. Mitigation: the sub line "Presentation costs marks too." completes the point on slide 1.
- Post 7 "We don't predict your grade." — complete on its own; passes.

Carousel continuity (post 4, slides 1→2): same eyebrow position, index, dot field, margins and footer; headline moves to a shorter three-line stack but keeps the same left edge and top anchor. Passes.

**No design depends on zooming**: nothing below 11.6 px at display size; headline ≥ 34 px.

What this does **not** prove: a real feed (platform compression, dark-mode inversion by the app, notches/overlays) and real devices. Human step: post a draft to a private/close-friends account and review on a mid-range Android and an iPhone before the first public post.

## 2. Caption and voice guidance

Register: **direct, unpatronising, premium, mature.** Written for a 14–18-year-old who is capable and busy, and for a parent who is sceptical.

Do
- Lead with the student's situation or a specific fact, in one short sentence. Two or three sentences total.
- Be specific: "left the unit off the final line", not "avoid common mistakes".
- Say what Axon doesn't do when it matters ("It doesn't change a mark.").
- Use the product's own words: **marks lost** (never "score"), **Fix this** (never "disagree"), "your teacher's marks", "reading" for an extraction, "source" for the crop.
- Show sample size with any insight: "47 questions · 6 papers".
- One call to action, calm: "Try it at axonstudy.online." or none.

Don't
- Exclamation marks, emoji as emphasis, rhetorical hype ("revolutionary", "game-changing", "supercharge", "unlock", "crush your exams", "ace", "AI-powered" as the selling point).
- Streaks, countdown pressure, FOMO ("last chance"), social proof you can't show, comparisons to other students, predicted grades, guarantees of improvement.
- Disagreeing with, correcting or second-guessing a teacher, in any phrasing ("you should have got…").
- "Are you sure?" patterns, shame framing about mistakes.
- Claims about marking schemes, tutors, accuracy figures or verification that aren't shipped and evidenced.

Terminology: *marks lost; cause; reading; source crop; Fix this; do this next; teacher's marks; official mark scheme (only where a verified stored source exists)*. Cambridge/CBSE/IB names only as descriptions of curricula, never implying endorsement (see Terms §10).

**Claims that require product evidence before use** (each needs a link in the post's brief): anything about accuracy or percentages; "checked against the official mark scheme"; anything about a tutor; guardian verification; share links ("read-only, expires, revocable" needs the AXO-88/89 production smoke); data location or retention; speed; offline behaviour; any curriculum/subject coverage.

Caption checklist: ≤ 3 sentences · no `!` · no claim without an evidence link · sample size on any insight · "illustrative example" on any synthetic paper · alt text written (describe the slide's words and the one visual) · no red outside a pen.

CTA style: a plain sentence with the domain, at most once, never imperative-urgent.

## 3. Source and export asset organization

Canonical home: the repo, so assets are versioned with the design system they derive from.

```
social/                                   (proposed top-level; this PR keeps drafts under docs/claude/social/)
  sources/<format>/<template-id>.svg      editable, text live, Onest + tokens inlined; one file per layout
  sources/_tokens.json                    snapshot of tokens used (generated by build.mjs)
  exports/<yyyy-mm>/<post-id>/            published only; never edited by hand
    ax-<yyyymmdd>-<format>-<slug>-v<n>-<nn>.png      e.g. ax-20261015-marking-misconception-unit-line-v1-01.png
  briefs/<post-id>.md                     copy, alt text, claim → evidence links, status (READY/HOLD), approvers
```

Conventions
- **Sources vs exports:** only `sources/` is edited; `exports/` is write-once. A fix = new `v<n>`, never an overwrite.
- **Export sizes:** feed 1080×1350 PNG (sRGB); square 1080×1080; story/reel cover 1080×1920; link card 1200×630; each at 1× plus a `@2x` only for screenshots. Under 1 MB per slide where possible.
- **Naming:** lowercase, hyphens, `ax-` prefix, date of first publication, format slug from §3 of the formats doc, one short slug, `v<n>`, two-digit slide number.
- **Versioning:** Git history for sources; `v<n>` in the export name for published artefacts; the brief records which source commit produced each export.
- **Linking in Linear:** the approved asset set is linked from AXO-86 as the `exports/<yyyy-mm>/` folder permalink plus the brief files. **Nothing is approved yet**, so no approved set is linked.
- Screenshot sources (synthetic-data captures) live in `sources/screens/` with the fixture that produced them.

## Open for human approval

- Real-device/real-feed legibility pass (§1).
- Approve voice rules and the asset convention; decide whether `social/` moves to its own repo or stays here.
- AXO-86's three boxes cannot be ticked until a human approves; the measurable parts (legibility metrics, contrast, convention) are done.
