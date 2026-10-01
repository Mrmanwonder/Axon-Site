# Social formats, pillars, templates and launch batch (AXO-85)

Depends on `claude_social-visual-foundations-2026-10-01.md` (AXO-84). Templates live in `docs/claude/social/templates/`.

Status: **spec, templates and a nine-post launch plan are done. The batch is a plan with draft copy, not finished posts: real product screenshots and approval are human steps** (see the end). No post below uses real student data or real exam content, and none shows red outside a teacher's pen on a depicted paper.

## 1. Anti-"AI startup" design review (every post must pass before it is posted)

A reviewer answers **yes to all** or the post does not ship.

1. Is every colour, size and font a token from `tokens.css` / the scale in the foundations doc?
2. Does it show or describe something the product actually does today (with the evidence reference in §5)?
3. Could this slide be mistaken for another company's post if the footer were removed? (If yes — too generic — rework.)
4. Absent: stock/neon gradients, robots, brains, circuit or "neural" imagery, glows beyond the single permitted wash, ✨, hype words.
5. Absent: a large score or percentage, rank/compare/predict, streaks, badges, urgency, confetti.
6. Red appears only as teacher's pen on a depicted paper.
7. Any number shown is sourced to a teacher's mark or a stated sample ("47 questions · 6 papers") and is not a verdict.
8. Smallest text ≥ 32 px on the 1080 canvas; passes the phone-size check in the legibility doc.
9. Synthetic data is labelled as illustrative; no real exam content.
10. Hard rule 1: nothing says or implies Axon grades, re-grades, or disagrees with a teacher.

## 2. Content pillars

Four pillars, each tied to a real student problem and to shipped behaviour:

| Pillar | Student problem | Product truth it stays inside |
|---|---|---|
| **P1 Where the marks went** | "I got 31/50 and don't know why." | Marks lost by cause (seven fixed causes, no ranking); sample size shown; empty states honest below ~4 papers |
| **P2 Your teacher's marks, explained** | "The comment says 'incomplete' and I don't see what's missing." | The model only writes `ai_explanation`; marks come from the teacher's pen or an official scheme; no re-grading |
| **P3 Check what Axon read** | "Is the app even reading my handwriting right?" | Review screen shows each reading beside its source crop; "Fix this" corrects a reading in seconds; unreadable pages are shown, never guessed |
| **P4 Specific exam technique** | "Revise more" is useless advice. | `do this next` quality floor: one specific, exam-performable action tied to this answer; nothing is shown if it can't clear the bar |

Explicitly **not** pillars: grade prediction, peer comparison, "AI tutor" (not shipped — AXO-19/39), streaks, motivation content.

## 3. Recurring formats

Each format has one composition rule so the feed reads as a system. All use the 4:5 template unless stated.

| Format | Slides | Composition rule | Allowed proof |
|---|---:|---|---|
| **Product detail** | 3–5 | Slide 1 states the single behaviour in one line; slide 2–3 is one real screenshot (whole screen or one card) with a one-line callout; last slide = footer only | Real UI, synthetic data |
| **Study insight** | 1 (square) or 3 | A specific action in the headline (the `do this next` standard) + one line of why; no number unless sourced | Cited habit, no scores |
| **Marking misconception** | 3–4 | Slide 1 is the misconception as a headline; slide 2 the actual rule in plain words; slide 3 a synthetic worked example tagged "Illustrative example · not a real paper"; "Your answer is right. The mark went for…" is the model for presentation losses | Synthetic example only |
| **Before / after paper review** | 4 | Left/right of the *same synthetic paper*: "marked paper" → "where the marks went" (cause dots, marks lost, one `do this next`). Never a real student's paper | Synthetic paper, real UI |
| **Feature launch** | 3–5 | Slide 1: what it does for a student. Slide 2–3: how (real UI). Last: what it doesn't do (limits). No "revolutionary" framing | Shipped + production-verified only |
| **Build in public** | 1–3 | A decision we made and the reason, including what we chose *not* to build ("We don't predict your grade") | A true decision with a link to the rule it comes from |

Variants (not one rigid template): dark vs light (insight squares may be light), cover-slide vs inner slide, screenshot slide vs text slide, story/reel-cover version (9:16 template with the safe zones), link-card version.

## 4. Templates

Editable SVG sources (text is live, uses Onest, tokens inlined) with rendered previews:

| File | Canvas | Use |
|---|---|---|
| `templates/tpl-portrait-4x5-dark.svg` | 1080×1350 | default for every carousel/single |
| `templates/tpl-portrait-4x5-light.svg` | 1080×1350 | insight posts only |
| `templates/tpl-square-1x1-dark.svg` | 1080×1080 | single insight |
| `templates/tpl-story-9x16-dark.svg` | 1080×1920 | story and reel cover (safe zones applied) |
| `templates/tpl-link-card-1200x630-dark.svg` | 1200×630 | link previews |

Each has a `.png` (full size) and `.phone390.png` (what the feed shows). Regenerate with `node docs/claude/social/tools/build.mjs`.

## 5. Launch batch (nine posts, reviewed as a feed)

Order is the posting order; the feed rhythm alternates *explain → show → decide*. Each claim lists the evidence that supports it today. **Status: READY** means every claim is supported by shipped, verified behaviour; **HOLD** means a claim depends on something not yet verified in production.

| # | Format / pillar | Cover line (slide 1) | Caption draft (≤ 3 sentences) | Evidence for every claim | Status |
|---|---|---|---|---|---|
| 1 | Feature launch · P1 | "See where your marks went." | "Axon reads a marked paper and explains each lost mark from your teacher's own marks and comments. It doesn't change a mark." | Explain pipeline writes only `ai_explanation`; `marks_source` ∈ {teacher_pen, official_scheme} (DB-enforced) | **HOLD**: capture path (camera vs upload) and onboarding must be confirmed shipped at posting time (AXO-11 open) — say "upload" until then |
| 2 | Product detail · P3 | "Every reading keeps its source." | "On the review screen each transcription sits next to the part of your page it came from. If it's wrong, tap Fix this." | Review screen + crop view (`Crop.tsx`), "Fix this" copy rule | READY |
| 3 | Study insight · P1 | "Seven causes. No ranking." | "Marks go for different reasons: concept, a slip, misreading the question, an incomplete answer, presentation, a missed keyword, time. Axon names which, per question." | `cause` enum; cause hues; no ramp rule | READY |
| 4 | Marking misconception · P2 | "Your answer is right. The mark went for…" | "…leaving the unit off the final line. Presentation costs marks even when the working is correct." | CLAUDE.md copy rule for `presentation`; synthetic example labelled | READY |
| 5 | Before/after · P1 | "A marked paper, and where the marks went." | "Same paper, two views. The marks are the teacher's; the explanation is Axon's reading of them." | Synthetic paper; real UI; hard rule 1 | READY once screenshot captured |
| 6 | Product detail · P3 | "Fix a reading in one tap." | "If Axon misread your handwriting, pick the right reading from the alternatives. Your correction applies immediately." | Disagree-flow spec: alternatives picker is the default landing state | READY once screenshot captured |
| 7 | Build in public · P2 | "We don't predict your grade." | "Your teacher marks the paper. Axon explains the marks they gave. Predicting a grade would be a guess presented as a fact." | CLAUDE.md "Explicitly not in v1" and hard rule 1 | READY |
| 8 | Study insight · P4 | "Write the formula on its own line before you substitute." | "A specific habit you can use in the exam hall. Axon only shows a next step when it can name one for your answer." | `do this next` quality floor (CLAUDE.md) | READY |
| 9 | Product detail · P2 | "Share a paper. Then stop sharing." | "A share link is read-only, expires, and can be revoked." | Share design (AXO-89) — server-side verified; **production authenticated smoke not yet done** | **HOLD** until AXO-88/89 production smoke passes |

Feed review (as a whole, not per post): dark throughout except one light insight (post 8); the eyebrow position, dot field and footer are identical on all nine; consecutive posts never use the same format; no two cover lines start with the same word. Rendered examples for posts 1, 4 and 7 are in `docs/claude/social/examples/` (`post01-*`, `post04-s1/s2-*`, `post07-*`) plus a story cover and a light square.

## Open for human approval

- Capture real product screenshots (synthetic data, 390×844 @3x) for posts 2, 5 and 6; none was captured here.
- Approve copy and the HOLD conditions for posts 1 and 9.
- Approve the batch as a feed (the AXO-85 packet requires approval).
