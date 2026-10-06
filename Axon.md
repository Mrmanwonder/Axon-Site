# Axon

Read this before writing code. It replaces `CLAUDE.md` (removed 2026-10-03). It was written from the code as it is, the Production Constitution, and the owner's stated decisions.

**Precedence.** The Constitution (`Constitution/`) outranks this file. This file outranks every other doc. `src/ui/styles/` outranks this file on design-system values. If two docs disagree, the higher one wins, and you record the disagreement in Linear instead of picking silently.

---

## 1. What Axon is

Axon turns a marked paper into feedback a student can act on. A student scans or imports a graded paper; Axon reads the questions, the student's answers and the teacher's marks, asks the student to confirm anything uncertain, explains where marks were lost, and builds insight from confirmed history.

> Every important claim about a student's work is traceable to evidence, explicitly uncertain, or withheld.

**The one loop:** Scan → Process → Review → Understand → Learn from confirmed history. Do not add a planner, missions, a digital twin, streaks, or a generic chat product. The tutor is a scoped helper on a student's own papers, not a general chatbot.

**Who it is for.** The student is the only daily user, ages roughly 13 to 17. A parent holds the account and pays. Curricula in the catalog: Cambridge (IGCSE, AS, A Level), CBSE, and IB Diploma (`src/curriculum.js`; the database is the catalog authority). Some older docs say "Cambridge only"; they are out of date.

**Not** a grading tool, not a teacher product, not a ranking or prediction product.

---

## 2. Principles

These come from the Constitution and from the owner. They decide ties.

1. **Evidence over confidence.** A fluent model answer is not a fact. Marks, boundaries, answers and explanations stay tied to their source.
2. **Honest uncertainty.** If evidence is incomplete, ask, show the doubt, or withhold. A plausible wrong answer is worse than an admitted gap.
3. **The student's correction is part of the system**, not an error path.
4. **Private by default.** A minor's papers never go to unrelated third parties. No behavioural tracking, no targeted advertising, ever.
5. **One product loop** (above).
6. **Production, not mock-ups.** No placeholder UI, fake APIs, TODO markers, stub workflows or lorem ipsum in production code (Constitution AXON-CONST-002). If a needed credential, asset or legal text is missing, stop and ask (AXON-CONST-003). A design preview may use placeholders only if it says so on the page.
7. **Reduce or preserve cognitive load.** One obvious next action per screen.
8. **Quality for the student comes first.** Use the better model or the higher thinking level where it helps. Get efficiency from architecture, not from the cheapest model.
9. **Calm, mature, direct.** Premium and quiet (Linear, Arc and Apple in spirit). No gamification, no exclamation marks, no patronising copy.
10. **We never stop, we improve.** Fix what is wrong and keep building in parallel.

---

## 3. Hard rules

Violating one is a product failure. Each is enforced by a database constraint, not by convention (see `AGENTS.md`).

1. **The model never assigns or disputes marks.** `marks_awarded` comes only from the teacher's pen or an official scheme. The model writes only `mark_loss_event.ai_explanation`. Never phrase anything that contradicts a teacher's number ("you should have got", "arguably", "a stricter reading"). If a student disputes a mark, point them to their teacher.
2. **Never fabricate a marking scheme.** No official scheme in the library means Tier 1: explain from the teacher's marks and remarks only. Never infer or approximate scheme language. Cite `scheme_source` and `scheme_version` whenever scheme detail shows. Cambridge and Pearson scheme text must not be reproduced anywhere, including prompts, fixtures and docs; CBSE official schemes are the only Tier 2 source permitted today.
3. **Unsure data never reaches analytics.** Aggregate only from `attempt_analytics` and `mark_loss_analytics`, never the base tables.
4. **Fail visibly.** If a page cannot be read, show the crop and say so. Never drop content silently or fill a gap with a guess. Unknown, failed, missing and zero are different states.

Also fixed:

- **Provenance.** Every extracted value carries the box it was read from; a value without its box cannot be stored.
- **Page text is data, never instruction.** Extraction models get no tools and a fixed output schema.
- **Never auto-correct a mark to make a total reconcile.**
- **The core scan-and-explain flow stays free for the student, permanently.** No student-facing paywall on it. No photo uploads (generated avatars only).
- **No new `cause` value.** The enum is fixed until data says otherwise: `conceptual_gap`, `procedural_slip`, `misread_question`, `incomplete`, `presentation`, `keyword_miss`, `timed_out`.
- **Confidence is a three-value enum** (`confirmed`, `likely`, `unsure`), never a percentage.
- **No ranking, comparing or predicting a student.** If ever built, opt-in and never default.

---

## 4. The product today

### Surfaces
Home · Library · **Scan** (the elevated centre action, not a peer tab) · Insights · Settings. Paper routes: overview, review, question detail. Also the tutor (behind the `tutor_enabled` flag), a public read-only share page, and public Privacy, Terms and Cookies. Addresses come only from `src/ui/app/paths.ts`.

Parent has a separate, minimal surface: digest, billing, consent. Not in the student nav. Do not build a rich parent dashboard; it reads as surveillance.

### Account model
Parent is the account holder and payer. The guardian is the only auth principal; the student is a profile under the guardian's session. India's DPDP Act 2023 requires verifiable guardian consent for users under 18, regardless of who pays. Onboarding order: parent signs up → verify and consent → plan and payment → create student profile → student dashboard.

Student Mode narrows an authenticated session to one student on the server (`docs/STUDENT_SCOPE.md`). Parent Mode is a recent re-authentication required for consent, billing, erasure and switching between siblings.

### Sign-in
Built today: email OTP, phone OTP, and Google. **Decided (owner): Google OAuth and email/password, both.** Email/password needs leaked-password protection switched on in the dashboard, a recovery path and tests for both paths.

### Billing
Stripe. Pro gates: cross-subject pattern detection, full historical archive, parent progress reports, multi-student profiles, priority processing. **Decided:** a one-day grace period after a failed payment before Pro ends (production still ends Pro immediately until that is built), and INR and USD both offered. The upsell fires only on a genuine cross-paper pattern, shown to the parent, never interrupting a student session.

### Models and privacy route
Gemini through Google AI Studio on the **paid tier** (owner decision: no training on our data). The Privacy Policy must declare retention honestly; it must **not** claim zero data retention, because the paid tier is not that. Model IDs live in `model_route`, never in code. Prompts are versioned files, never edited in place. Nothing about student papers goes to Tavily; its query is built server-side from subject, stage and a concept label.

### The scanner
Being rebuilt from the ground up (Linear AXO-144; plan in `docs/claude_scanner-ground-up-plan-2026-10-03.md`). The in-app camera ships; the old "no in-app camera in v1" line is gone. See section 7.

### Dates on a paper
`paper.date_taken` defaults to the upload date. Owner decision: show the exam date when it is known; otherwise label the date as the upload date ("Added <date>"). Never show a bare date.

---

## 5. Architecture and ownership

**Two repositories, one production paper pipeline.**

- **Axon-Site** (this repo): web UI and routing, the scanner/camera UX, local and offline browser state, Supabase schema and migrations, billing Edge Functions, public and legal pages. Stack: Vite, React 19, TypeScript, React Router, Tailwind with the default theme cleared (so `src/ui/styles/` is the only vocabulary), Supabase.
- **axon-backend** (`Mrmanwonder/axon-backend`): the paper API, R2 access and signed assets, Cloudflare Queues, triage, structure, crop, content, reconcile, adjudicate, explain, Gemini, Tavily, sweep. **Do not build a second model client, scanner worker, or queue consumer in Axon-Site.** The pipeline files under `supabase/functions/` are a stale copy and not production.

`src/scan/contract.js` and `axon-backend/shared/src/contract.ts` are a pair. Change both or neither; CI checks parity.

Other fixed points:

- The scan stage modules (`src/scan/`) are pure ES modules that run on the main thread, in the Web Worker, and in Node under `harness/`. Keep them that way. `src/app.js` imports the scanner dynamically on purpose.
- Supabase holds state, row-level security and auth. Cloudflare holds orchestration and storage (R2: originals with expiry, derived retained).
- Bytes never pass through a function: devices PUT to presigned URLs and the server confirms with HEAD.
- Internal helpers live in `private`. Every `SECURITY DEFINER` function pins `search_path`. Views touching user data use `security_invoker = true`. `consent_event` is append-only; order by `seq`.
- Database changes: a versioned migration in `supabase/migrations/`, applied, then Supabase advisors re-run with no new warnings. Production must never differ from the repo.
- Offline: past papers and their analysis are readable offline. Scanning and extraction are online-only; queue nothing that needs a model.
- Performance floor: 60 fps on a mid-tier Android. Real constraint, not an aspiration.

### Data model essentials
The atomic unit is an **attempt at a question**, not a paper. Two tiers: Tier 1 school tests (no scheme; `canonical_question_id` null) and Tier 2 papers matched to a shared `canonical_question` that carries the official scheme.

`marks_source` is `teacher_pen` or `official_scheme`; both are human. A Cambridge subject is identified by its syllabus code, not its name.

**Counting contract (AXO-122).** One placement walk (`placeRegions` in `src/questionCount.js`) feeds both the counts and the grouping on screen, so they cannot disagree. Terms: `questions_total` (top-level questions), `parts_total`, `unassigned_parts`, `raw_region_count`. The SQL function `public.question_count_contract` mirrors it, tied by `tests/fixtures/question-count-contract.json`. No screen says "questions" when it means parts. A part that cannot be placed is shown as unassigned, never guessed into a question.

---

## 6. Design language

`src/ui/styles/` is the design system (`tokens.css` layers palette → surface → role → component; `system.css` is the component system). Read it before building UI. Components reference roles, never raw palette values.

**Colour**
- **Red appears in the interface in one place only: the sign-out row.** Not errors, warnings, low marks, notification badges, or delete. **A teacher's ink can be any colour (black, blue, red, pink, anything); never assume or encode that it is red** (owner, 3 Oct 2026). `TEACHER_INK = 'red'` in `src/scan/contract.js` and the red-hue mask in `src/scan/layers.js` encode that wrong assumption and are tracked for replacement in Linear; do not extend them.
- Amber carries attention and destructive actions. Blue carries accent and "locked" or "primary".
- Cause colours encode kind, never severity (seven hues of equal weight, never a green-to-red ramp). Values are in `tokens.css`.
- **Confidence is form, not colour:** confirmed = solid, likely = light fill with a border, unsure = dashed outline. It must survive greyscale and screenshots.

**Type.** Onest, self-hosted latin variable subset. Tabular numerals everywhere. Never set a mark above 28 px; a large number reads as a verdict. Devanagari is an open item.

**Layout.** Mobile viewport is the design target (about 380 px). At 768 px and above the tab bar becomes a left rail; at 1024 px and above the rail gains labels. Prefer `clamp()` over new breakpoints. Every tap target is at least 44 px. Both themes are first-class; dark is primary because students study at night.

**Icons.** Google Material Symbols (owner decision); licence file in `third_party/material-design-icons/`.

**Motion.** Transform and opacity only. 120 ms for state changes, 200 ms for disclosure and transitions, 320 ms for the recompute after a correction (the signature moment). Honour `prefers-reduced-motion` and the in-app Reduce motion switch. **The capture flow's motion, approved by the owner:** a captured page drops onto the stack (220 ms); sheets (every sheet, including More, page review and drafts) rise from the bottom edge on the iOS sheet curve `cubic-bezier(.32,.72,0,1)` with no overshoot and fall back to it (440 ms in, 300 ms out; tokens `--ease-sheet`, `--sheet-in`, `--sheet-out` in `system.css`); the scanner fades up and its top bar and dock settle 8 to 10 px into place a beat later (460 ms), and it closes with a plain 200 ms fade. Nothing bounces. Transform and opacity only, none under reduced motion. Nothing else moves during capture. Delight lives after a task finishes, never during one. No mascots, confetti or streaks.

**Surfaces over live video.** Solid, not blurred or glass. Nothing floats over the paper except the corner brackets and the level line.

**Nav.** The tab bar's highlight is a real `feDisplacementMap` filter, measured not computed. Read `AGENTS.md` ("Before changing the nav or the glass") before touching it.

---

## 7. The scanner

Owner decisions applied to the rebuild:

- **Capture never depends on detection.** The shutter always works. Detection assists. A page the detector cannot find is flagged, never lost, and can be fixed by dragging its corners.
- **Say why.** When the page is not locked, show one measured reason (too dark, small, cut off, shaky, blurry, glare, nothing found). Never state a reason that was not measured.
- **Detection starts on public-library defaults.** Tuning happens only against a corpus of real phone footage supplied by the owner. No threshold change without it. Synthetic perturbations are a labelled stress set, never proof.
- **Auto capture is on by default**, with the shutter always live. Auto | Manual is a labelled pill with a dot.
- **Torch:** Auto, On, Off, shown only where the camera exposes a torch. Auto turns it on when the scene is too dark. Where there is no torch (for example iPhone Safari), the strip says so and offers no action.
- **Layout:** top bar with close (✕), the Auto pill, drafts, and a "more" menu; the camera; a guidance strip under it; then the stack, a navbar-capsule shutter and Done.
- **The stack.** Captured pages drop onto a pile at slight angles, newest on top, with a count. A flagged page has an amber dashed outline.
- **The shutter** has the navbar's capsule shape (32 px shell, 5 px margin, 26 px inner pill).
- **Done goes straight to reading when every page is fine; it becomes Review when any page is flagged.** A page is fine only on evidence: confident edges and a passed quality check.
- **Laptop (fine primary pointer, hover, width at least 768 px) shows an import screen**, not a webcam: drag and drop, choose files, paste, link, drafts, and a QR to open Scan on a phone. No webcam option.
- Limits and formats come from `src/scan/contract.js` (up to 25 pages; JPG, PNG, WebP, HEIC/HEIF, PDF).
- Camera denied or unavailable offers Retry, "Use your camera app", and Import.
- Real-device behaviour is never claimed without a physical trial. Automated tests and a synthetic browser run do not satisfy a device requirement.

---

## 8. Copy rules

- "Marks lost", never "score" or percentage-correct on summary surfaces.
- "Fix this" for transcription corrections. "Not why I lost it" for cause corrections. Never "disagree".
- Never "are you sure?". If a confirmation feels needed, redesign so it is not. Destructive actions use the consequence sheet that states what will happen.
- No exclamation marks. No streaks, badges, or gamified progress.
- Every headline insight shows its sample size ("47 questions · 6 papers").
- Lead with what is right when the cause is presentation: "Your answer is right. The mark went for…"
- Empty states are honest. With fewer than about four papers, say there is not enough data yet; do not draw a chart on noise.
- **"Do this next"** must reference something specific to this answer and be an action performable in an exam ("Write the formula on its own line before you substitute"). If the model cannot clear that, render nothing.
- Transcription wrong → the student is the authority, accepted instantly (alternatives picker first, then type, then rescan). Cause wrong → accepted immediately and removed from analytics. Marks disputed → point back to the teacher, warmly.

---

## 9. How the owner wants work done

**Linear is the system of record** (team Axon-26, project Axon; AXO-28). Repos, CI, Supabase and Cloudflare hold evidence. Nothing is planned, active, blocked, verified or complete unless Linear says so.

1. **Read before you act.** Read the issue in full with relations, plus parent and children. Each `- [ ]` box is an acceptance item.
2. **Tick only with evidence** (commit SHA, PR, CI run, query output, live response, screenshot, test name) in a comment on that issue. Merged is not done; a migration file is not applied; merged backend code is not live.
3. **Move status only on evidence.** Needs something only a human can do (real device, legal sign-off, third-party account, a product decision) → stays open with a comment starting `BLOCKED-ON-HUMAN:` that states the exact ask.
4. **Never invent results.** If you could not run it, say so, do the preparatory work, leave it open. Never write "tested on mobile" without a real device.
5. **Parents close only when every child is done.**
6. **New work is recorded first.** A bug, risk or scope change found mid-task goes into Linear before it is acted on.
7. **Open product decisions are the owner's.** Write the options and a recommendation, ask, and do not resolve them in code. This covers: a missing or ambiguous marking scheme; any UI that shows a number we cannot source to a teacher or a scheme; any feature that ranks, compares or predicts a student; any place the design language has no established pattern. The defaults this project has already refused are red errors, big score displays, streaks and percentage confidence.

**Working style.**
- Direct answers, plain words, no filler. Lead with what changed and what remains.
- The owner will push back on scope and defers on technical and legal recommendations. Flag unresolved decisions explicitly instead of resolving them.
- When a spec turns out wrong, issue a corrective addendum instead of patching silently.
- Specs and reports are standalone files named `claude_[descriptor]-[YYYY-MM-DD].md`, linked from the Linear issue. They must be usable by an agent with no other context.
- **"Build me a spec sheet" means a detailed prompt and plan the owner can send straight to an agent** to carry out the work: context, ordered steps, files, acceptance checks, stop conditions. It is not a status report.
- Secrets are never printed, committed, pasted into Linear, or placed in `VITE_*` variables.
- Legal text is drafted for counsel and never published by an agent. Dates change only in the final publication commit.
- Share links are bearer tokens: do not repeat them, and revoke them after use.

**Commits and PRs.** Commit messages end with the trailer lines the session provides (`Co-Authored-By`, `Claude-Session`). PR descriptions end with the "Generated with Claude Code" line and the session link.

**Verification before requesting a merge.** Run typecheck, lint, unit and integration tests, and the build; confirm CI is green on the exact head; re-read your own diff. Layout, the lens, haptics and the viewfinder still need a real browser at phone, landscape-phone, 768 px and 1024 px widths. Real-device requirements are never satisfied by automation.

**Status policy.** Backlog (valid, not committed) · Todo (fully specified) · In Progress · In Review (implementation exists; verification, rollout or acceptance remains) · Done (implementation, tests, deployment and acceptance evidence) · Duplicate (points to the canonical issue).

---

## 10. Checks

```bash
npm test               # bench + harness (node --test)
npm run typecheck
npm run test:ui        # vitest, jsdom
npm run test:e2e       # Playwright (Chromium and WebKit in CI)
npm run test:a11y      # Playwright, axe, WCAG 2.2 AA
npm run test:db        # database tests (PGlite)
npm run curriculum:validate
npm run check:contract-parity
npm run build
```

Backend, in `Mrmanwonder/axon-backend`: `npm run typecheck`, `npm test`, `npm run dry-run`.

---

## 11. Owner decisions on record (2026-10)

- Privacy route: Gemini on Google AI Studio paid tier; declare retention in the policy.
- Guardian verification provider work is parked.
- Icons: Google Material Symbols.
- Sign-in: Google OAuth and email/password, both.
- Billing: one-day grace after a failed payment; INR and USD both.
- Postgres minor upgrade deferred until a major upgrade.
- Paper dates: exam date if known, otherwise labelled as the upload date.
- Project target 15 Oct 2026: a private beta of the core loop (scan, read, explain, review), not a public launch.
- Scanner: close button top-left; page-drop animation welcome; Auto on by default; torch Auto, On, Off; no webcam on laptops; Done reads directly when all pages are fine, otherwise Review.
- Scanner (4 Oct, later): motion is deliberate and Apple-like, never bouncy; top-bar controls are a 38 px material inside 44 px targets with clear space above and below; More has no Close row; the light control is called Torch and uses the onboarding glide selector (`GlideSegment`).
- Scanner (4 Oct): use each device's main (1x) rear camera; tablets get the full-screen camera, never the laptop import screen; sheets and the scanner open and close with motion; More is a plain list on the sheet, no card inside it.
- Teacher ink can be any colour (black, blue, red, pink, anything). Never assume or encode that it is red. In the interface red stays reserved for the sign-out row.
- Paper subject (4 Oct): when triage's high-confidence suggestion matches exactly one of the student's own subjects, the paper gets that subject automatically; the student can change or clear it from the paper. An official assessment identity still overrides both. (`private.auto_assign_paper_subject`, `public.set_paper_subject`.)
- Syllabus map (4 Oct): one map per subject from the board's published syllabus, full learning-objective text stored (database only; this repository is public, so it holds the parser and a checksummed source manifest, never the text). Darker = more marks lost, one accent hue, never red, never a percentage. Untested topics are a dashed outline, never weak. Syllabus documents load as draft and students see one only after a person marks it verified.
- Insights (5 Oct): a command word is named only once it covers 3 questions that lost marks; the end-of-paper (pacing) section stays, reading the run of blank zero-mark questions at the end of each paper in printed order.
- Sign-in: email/password will be built (alongside Google), as already decided.
- **Scheme check for unmarked Cambridge papers (6 Oct 2026, owner).** A narrow exception to hard rules 1 and 2. When an unmarked Cambridge past paper prints its exact code (e.g. `9231/11/O/N/25`), Axon locates the published mark scheme for that one file (`9231_w25_ms_11.pdf`) with Tavily and Firecrawl, confirms the code on the page and inside the scheme PDF, and gives per-question feedback plus an **estimated** mark. The scheme is private model input only: never stored (only its filename), never shown or quoted to the student. Estimates live only in `paper_check` / `region_check`, are never `confirmed`, never written to `marks_awarded`, never reach analytics, and are always labelled as Axon's estimate, not a teacher's mark. Everywhere else hard rules 1 and 2 stand unchanged, and open-web search still filters mark-scheme sources. Owner's stated basis: internal checking only, not reproduction. Flagged for counsel.
- Exam dates (6 Oct, AXO-207): Home's "What's coming up" reads the board's own timetable. For Cambridge the card asks once for country (city only where a country spans zones) and exam series; both are editable in Settings. Papers that every published route at the student's level requires are filled in from the syllabus; the rest the student chooses; every choice stays editable in Settings. A paper set on two dates in one zone shows both (the school assigns which). Nothing is pre-selected for the student. CBSE and IB show honest "no dates yet" states until a source is loaded.
- Scanner follow-ups (3 Oct): importing accepts every common image type and PDFs (PDFs are crucial); the auto crop will be fine-tuned on real clips and Adjust edges stays part of the flow; landscape phones are not handled now and are a goal for the next release; a "warn" quality verdict is a note and does not flag a page (D25, owner delegated, option A); the `'wasm-unsafe-eval'` CSP entry is accepted for the ML runtime; the scanic and DocCornerNet licences are MIT (`third_party/scanic/NOTICE.md`).
- Earlier numbered decisions are in `docs/claude_axon-decisions-2026-10-02.md` and the owner runbook.

---

## 12. Known inconsistencies to fix, not to copy

- `README.md` was brought up to date on 3 Oct 2026; re-check it whenever the product changes. The opening of `AGENTS.md` still describes a single static `index.html` with no build step; the app is Vite and React now, and `reference/prototype.html` is the pre-port original.
- `docs/claude_*` files are dated records. They are evidence, not instructions.
- Comments in applied migrations still mention `CLAUDE.md`; applied migration files are not edited for a comment.
- The legal pages may still describe a retention route that is no longer true; counsel decides the corrected wording.
