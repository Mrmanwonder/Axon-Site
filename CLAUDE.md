# CLAUDE.md

Project context and hard constraints. Read this before writing code.

## What this is

A study companion for Cambridge (CAIE) students — IGCSE, AS and A Level. They upload
graded exam papers;
the app extracts questions, their answers, and the teacher's marks, then explains where
marks were lost and what to do differently.

Not a grading tool. Not a teacher product. The student is the only daily user.

## Hard rules

These four are load-bearing. Violating any of them is a product failure, not a style miss.
Each is enforced by a database constraint, not by convention — see `AGENTS.md`.

### 1. The model never assigns or disputes marks

`marks_awarded` is sourced only from the teacher's pen or an official marking scheme.
It is a fact field. The model writes only to `mark_loss_event.ai_explanation`.

Never generate output that contradicts a human grader's number, in any phrasing —
including "you should have got", "arguably", or "a stricter reading would". If a student
disputes marks, the response points them back to their teacher.

Reason: the app has no standing to overrule an absent examiner, and a student quoting us
against a teacher and being wrong ends our credibility permanently.

### 2. Never fabricate a marking scheme

If an official scheme is not in the library, the paper is Tier 1 and we explain using the
teacher's actual marks and remarks only. Never infer, reconstruct, or approximate scheme
language. Always cite `scheme_source` and `scheme_version` when scheme detail is shown.

Paraphrase mark allocation in our own words rather than reproducing scheme text verbatim.

### 3. Unsure data never reaches analytics

Any extraction or diagnosis at `unsure` confidence is excluded from aggregation until a
student confirms it. Silent inclusion compounds one bad read into a confidently wrong
conclusion about a student's weaknesses.

Aggregate from `attempt_analytics` and `mark_loss_analytics`. Never from the base tables.

### 4. Fail visibly

If OCR cannot read a page, show the crop and say so. Never silently drop content, and
never fill a gap with a plausible guess. Admitted gaps are recoverable; invisible ones
corrupt everything downstream.

## Stack

- Web-first PWA. Mobile viewport is the design target (~380px); desktop is secondary.
- Vite + React + TypeScript, routed with React Router. Tailwind's default theme is
  cleared, so `src/ui/styles/` is the only vocabulary. The React app is `src/ui/`;
  `src/` holds the data and scanning modules it imports.
- The scan pipeline stays plain ES modules on purpose. Its stage modules are pure and
  run on the main thread, in the Web Worker AND in Node under `harness/`; rewriting
  them as components would break two of the three.
- Supabase: Postgres, auth, storage. Auth is email or phone OTP only.
- Offline: past papers and their analysis must be readable offline. Scanning and
  extraction are online-only. Cache read paths; queue nothing that needs the model.
- Performance floor: must hold 60fps on mid-tier Android. This is a real constraint, not
  an aspiration — most users are on budget devices.

## Data model

Atomic unit is an attempt at a question, not a paper.

```
guardian           id, auth_user_id, name, contact, verified_at,
                   verification_method, verification_ref, deleted_at
consent_event      id, seq, guardian_id, student_id?, purpose, granted,
                   notice_version, method, created_at     ← append-only
student            id, guardian_id, board, class_level, age_band, first_name
paper              id, student_id, type, tier, date_taken
paper_page         id, paper_id, student_id, page_number, source_kind,
                   storage_path?, source_url?, status
student_attempt    id, paper_id, canonical_question_id?, marks_awarded,
                   max_marks, marks_source, teacher_remark,
                   extraction_confidence, student_confirmed_at
canonical_question id, board, exam_year, question_text, marking_scheme,
                   scheme_source, scheme_version
mark_loss_event    id, attempt_id, cause, marks_lost, ai_explanation,
                   do_this_next, confidence, student_confirmed_at,
                   student_rejected_at
page_unreadable    id, paper_id, page_number, storage_path, reason
concept            id, name, chapter_id
```

Two tiers:
- Tier 1 — school tests. No official scheme. `canonical_question_id` is null.
  Explanation is grounded in the teacher's marks and remarks.
- Tier 2 — Cambridge past papers and specimen papers. Matched to a shared
  `canonical_question` carrying the official scheme. Extracted and verified once, reused
  across all students.

`board` is CAIE for every new profile; CBSE remains in the enum only for accounts created
before the switch. `class_level` stays 9–12 and carries the Cambridge stage: 9 and 10 are
IGCSE (Years 10 and 11), 11 is AS Level, 12 is A Level. The stage is derived from it in
`src/curriculum.js`, never stored twice.

A Cambridge subject is identified by its four-digit syllabus code, not its name: Physics is
0625 at IGCSE and 9702 at A Level, with different papers and different mark schemes. The
code is collected at profile creation and re-mapped when a student changes stage.

`cause` is a fixed enum: `conceptual_gap`, `procedural_slip`, `misread_question`,
`incomplete`, `presentation`, `keyword_miss`, `timed_out`.

`confidence` is a three-value enum: `confirmed`, `likely`, `unsure`. Never a percentage —
we have no calibration to justify one.

`marks_source` is `teacher_pen` or `official_scheme`. Both are human origins; the model is
not one, which is what makes rule 1 unfalsifiable at the schema level.

## Design language

**The design system is `src/ui/styles/`, carried over verbatim from the pre-port
`index.html`.** There is no separate DESIGN_SYSTEM.md. `tokens.css` layers the tokens
(palette → surface → role → component); `system.css` is the component system, extracted
rather than retyped so it cannot drift; the `feDisplacementMap` glass lens and the spring
engine are in `src/ui/lib/`. `reference/prototype.html` is the pre-port original, kept
for comparison. Read the styles before building or editing any UI. Where this document
and the stylesheet disagree on the design system, the stylesheet wins; where they
disagree on information architecture, this document wins.

**Red is reserved for signing out.** It is the one place red appears in the interface —
not for errors, not for warnings, not for low scores, not for notification badges, and
not for destructive rows like deleting data. Everything else that needs attention uses
amber, and everything that needs an accent uses blue. The scan crop contains real red pen;
if the UI spent red freely, every screen would start to feel like a rebuke.

**Cause colours encode kind, not severity.** Seven distinct hues of equal visual weight,
never a green-to-red ramp — that would turn the concept heatmap into a shame map.

- conceptual_gap `#4C7DF0` · procedural_slip `#3FA9A0` · misread_question `#8A6FD1`
- incomplete `#C98A3E` · presentation `#C46B8A` · keyword_miss `#7C9455`
- timed_out `#78808F`

**Confidence is expressed as form, not colour.** Confirmed = solid fill. Likely = light
fill with border. Unsure = dashed outline. Survives greyscale and colourblindness;
students screenshot constantly.

**Typography.** Onest, embedded as a self-hosted latin variable subset. Tabular numerals
everywhere, so marks don't jitter when recomputed. Never set a mark above 28px — a large
number reads as a verdict. Devanagari is still an open item: Hindi-medium content appears
in questions, remarks, and schemes, and Onest does not cover it.

**Dark mode is primary, not an afterthought.** Students study at night. Both themes are
first-class and defined as custom properties on the root element.

**Motion.** Transform and opacity only. No layout, blur, or shadow animation.
- 120ms — state changes (chips, toggles)
- 200ms — disclosure, transitions
- 320ms — recompute after a correction. This is the signature moment; spend the budget
  here and almost nowhere else.

Capture flow gets zero decorative motion. Honour `prefers-reduced-motion` and provide an
in-app toggle (Settings → Reduce motion, which sets `data-motion="reduce"`).

**Delight lives in the seams.** Small, earned acknowledgments after a task completes —
never during one. No mascots, no confetti, no streaks.

## Copy rules

- "Marks lost", never "score" or percentage-correct on summary surfaces.
- "Fix this" for transcription corrections. "Not why I lost it" for cause corrections.
  Never the word "disagree".
- Never "are you sure?". If a confirmation feels needed, redesign so it isn't. Never
  build a UI that makes the user prove themselves to the machine. Destructive actions use
  the consequence sheet, which states what will happen, rather than asking for reassurance.
- No exclamation marks. No streaks, badges, or gamified progress.
- Every headline insight shows its sample size ("47 questions · 6 papers").
- Lead with what's right when the cause is presentation: "Your answer is right. The mark
  went for…"
- Empty states are honest: with fewer than ~4 papers, say there isn't enough data yet
  rather than rendering a chart built on noise. `student_analytics_readiness` reports this.

### The `do this next` quality floor

Must reference something specific to this answer, and must be an action performable
during an exam.

- Passes: "Write the formula on its own line before you substitute."
- Fails: "Revise Newton's laws." / "Practice more numericals."

If the model cannot clear this bar, render nothing. An empty slot is honest; generic
advice trains students to stop reading.

## Disagree flow

Two distinct paths, never merged:

- **Transcription wrong** → student is the authority. Accept instantly, no verification,
  no review. Ladder: pick from alternatives (one tap, the common case) → type it →
  rescan. Budget is seconds; the alternatives picker is the default landing state.
- **Cause tag wrong** → accept immediately. This is self-knowledge and exactly the signal
  we want. Sets `student_rejected_at`, which removes it from analytics.
- **Marks disputed** → we don't adjudicate. Point back to the teacher, warmly.

Corrections apply to the student's own data instantly and the affected insight visibly
recomputes. A human review queue exists only to decide whether the *canonical* record
needs fixing — it is invisible infrastructure, not a user-facing feature, and there is no
"reviewed by our team" badge.

If many students correct the same canonical question the same way, that is a bug report,
not suspicion of individuals.

## Navigation

Five destinations. Scan is the elevated centre action, not a peer tab.

Home (snapshot) · Library (archive) · **Scan** · Insights (deep dive) · Settings

At ≥768px the tab bar becomes a left rail; at ≥1024px the rail gains labels. The lens is
measured, never computed — see `AGENTS.md`.

Parent has a separate, minimal surface: digest, billing, consent. Not in the student nav.
Do not build a rich parent dashboard — it reads as surveillance.

## Account model

Parent is the account holder and payer; student is the daily user. Verifiable guardian
consent is required under India's DPDP Act 2023 for users under 18, regardless of who
pays. Onboarding order: parent signs up → verify and consent → plan and payment →
create student profile (board, class, subjects) → student dashboard.

The guardian is the only auth principal. The student is a profile under the guardian's
session, not an auth user.

No behavioural tracking or targeted advertising. Ever.

## v1 scope

Ordered milestones. Do not start the next until the previous holds.

1. **Question detail screen, hardcoded data, fully polished.** Exercises the whole design
   language. Get this feeling right before anything is real.
2. **OCR accuracy harness** — 20 real marked papers, measure extraction of questions,
   student answers, and teacher's red-pen remarks separately. Red-pen extraction is the
   riskiest assumption in the product. If it comes back poor, the product changes shape,
   and it is far cheaper to learn that now.
3. **Supabase schema + auth + onboarding**, per the account model above. — *built*
4. **Upload-first ingestion.** No in-app camera in v1 — phone camera apps are better than
   anything achievable in a PWA, and shipping a mediocre scanner undermines the core
   quality claim. Build capture properly once extraction is proven. — *built*
5. **End-to-end: one paper uploaded → extracted → explained.** Extraction is the
   remaining gap: pages reach storage, but nothing reads them yet.

Explicitly not in v1: in-app camera, practice questions, peer comparison, predicted board
scores, CBSE, ICSE and state boards, parent dashboard beyond billing and consent.

Peer ranking and score prediction are engagement rocket fuel and mental-health hazards in
this market. If they are ever built, they are opt-in and never default.

## Ask, don't guess

Surface these rather than inventing an answer:

- Any case where a marking scheme is missing or ambiguous.
- Any UI that would show a student a number we cannot source to a teacher or a scheme.
- Any new `cause` value — the enum is fixed until we have data saying otherwise.
- Any feature that ranks, compares, or predicts a student's performance.
- Any place the design language has no established pattern. Reaching for a common default
  is usually wrong here: the defaults are red errors, big score displays, streaks, and
  percentage confidence, and every one of those is a decision this project has already
  made against.
