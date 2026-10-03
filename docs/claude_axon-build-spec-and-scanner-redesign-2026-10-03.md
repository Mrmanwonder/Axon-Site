# Axon — Build Spec (everything remaining), advice, and scanner redesign

2026-10-03. Supersedes the work-package list in `claude_linear-agent-spec-2026-10-03.md` where they differ (decisions D1–D14 are now applied). The owner runbook `claude_owner-runbook-2026-10-03.md` still holds the step-by-step for owner-only work; section 6 below lists what changed in it.
Project target date: **15 Oct 2026**. That is 12 days away; section 1 says what is realistic.

---

## 0. What was verified this session, and what was not

**Verified (browser harness, unit, build; no production data, no physical device):**
- Paper overview rebuilt (AXO-135) and action icons (AXO-137): commits `03a41ed`, `e8ec8c1` on `build/wp-c-paper-review`.
- Grouping and counting come from one placement function (`placeRegions` in `src/questionCount.js`); the screen's totals cannot disagree with its groups (tested).
- 10/10 browser checks at 360/390/768/1024/1440 px × dark/light: no horizontal overflow, every part path on screen, every row ≥ 44 px, axe WCAG 2.2 AA clean.
- Full unit suite, build and the offline e2e (`production.spec.ts`) green at the last run.

**Not verified (do not read any of the above as these):**
- Real phones, Safari/WebKit, the deployed site, a signed-in session, a real paper through the whole pipeline.
- Contract parity of the SQL function vs `questionCount.js` against the live database (the sandbox cannot reach GitHub's API for that CI step).
- The live shared page was compared by you, not by me; I could not open it from the sandbox.

**Findings from the comparison against the old shared-question page:** a bare "(d)" had no parent identity; muted uppercase labels; "Likely" alone was ambiguous. All three are fixed in the new overview ("Read clearly / Likely read / Needs checking / Confirmed by you", full part path, unassigned parts shown as their own honest group).

**New finding to record in Linear (not yet recorded):** `paper.date_taken` defaults to `current_date`, so it may be the *upload* date, not the exam date. The UI says "Dated 7 Sep" neutrally. Needs a data-model decision (section 5, D15).

---

## 1. Honest timeline to 15 Oct

Twelve days. The long poles are things only you can do: real-device scanner trials, signed-in production walkthrough, real papers, counsel review. Agent work is fast; owner gates are what set the date.

| Can finish by 15 Oct (agent) | Realistic only if you unblock it | Will not make 15 Oct |
|---|---|---|
| WP-C (paper/review redesign, minus device-only parts), WP-B, WP-D, WP-I, WP-K drafts, WP-H audit, billing grace + INR/USD, auth methods, tutor behind flag | Tutor beta (needs your secrets, R-5), device acceptance (R-7), prod walkthrough (R-8) | Counsel-approved legal publication (depends on counsel), Tutor GA (needs 500-case set + rollback drill), Postgres upgrade (deferred by you), guardian provider go-live (D2 parked) |

Recommendation: call 15 Oct **"private beta of the core loop"** (scan → read → explain → review), not "launch". The core loop's remaining risk is the scanner on real phones, not code volume.

---

## 2. Ground rules (corrected)

Everything in `CLAUDE.md` stands. One correction to my earlier spec: it said "red is reserved for teacher ink". `CLAUDE.md` says **red is reserved for sign-out only**; amber for attention and destructive rows; blue for accent. Use the `CLAUDE.md` rule.

Also keep: never assign or dispute teacher marks; no fabricated schemes (no Cambridge/Pearson scheme text); unsure data never reaches analytics; fail visibly; "Marks lost" not "score"; marks ≤ 28 px; confidence as form (solid / light+border / dashed); 60 fps on mid-tier Android; no exclamation marks or streaks; Linear first (read in full, tick only with evidence, `BLOCKED-ON-HUMAN:` comments, never invent results).

**Docs that now contradict decisions (agent task, WP-0):**
- `CLAUDE.md` says "Auth is email or phone OTP only" → D11 chose **Google OAuth + email/password**. Update after the auth work lands.
- `CLAUDE.md` v1 scope says "no in-app camera in v1" yet a full in-app scanner ships. Decide which is true (section 4) and make the doc match.
- `CLAUDE.md` says "Parent … billing … consent" only; D6 adds a 1-day grace period and INR/USD — record it.

---

## 3. Work packages

Status key: **Built** (code exists, evidence partial) · **Todo** · **Owner** (only you can do it). Effort: S < 1 h · M half-day · L multi-day.

### WP-0 — Board hygiene (S)
Same list as before, plus: set project target date 2026-10-15 (done by you) and move overdue items (AXO-122, AXO-87) to it or explain; record the `date_taken` finding; record the CLAUDE.md contradictions above; post evidence comments for AXO-135/137 (commits above, tests above, and the *Not verified* list). AXO-135 **stays open**.

### WP-B — Question-count contract (AXO-122) (M) — Built, unproven in prod
Frontend now uses one placement walk. Remaining: run the contract-parity check where GitHub is reachable (CI), confirm the deployed Library / Needs-your-eyes / overview all use the one function, and compare against the stored production paper in your earlier screenshots with read-only SQL. Acceptance unchanged from AXO-122.

### WP-C — Paper and review redesign (AXO-132 family) (L)
| Item | State | Remaining |
|---|---|---|
| AXO-134 spec | Done, approved (D14) | — |
| AXO-135 overview | Built | `date_taken` provenance; identity audit; question-detail header; cross-page continuation; review of the styled screenshots by you |
| AXO-137 icons | Built (Material Symbols, Apache-2.0 licence file added, 44 px) | Apply the same icons to the remaining screens |
| AXO-136 review cards + teacher-mark selector | Todo | Zero vs unread vs unconfirmed explicit; no browser radios |
| AXO-138 extraction audit | Todo | Needs the matching run or paper (R-9) |
| AXO-139 one math renderer | Todo | Fix literal `\n`, raw `\sqrt`/`\frac`, carets |
| AXO-140 tables | Todo | Real table rendering, structure preserved |
| AXO-141 scanner reference comparison | Todo | Offline artifact comparison only |
| AXO-142 truthful counts + parent gate | Todo | Before/after screenshots of the seven original complaints, mobile + desktop |

### WP-D — Small UI items (S each) — Todo
- **AXO-133 Contact**: Settings row, `mailto:` plus copy-address fallback plus a short form (you chose both in D9). One shared support-address constant.
- **AXO-130 Share → auto-copy**: keep Parent Mode and the sheet that says what will be visible; copy after minting using the promise form of `ClipboardItem`; toast "Link copied · expires in 24 h · Stop sharing".

### WP-E — Pipeline close-out (AXO-116) (M) — Owner-gated
Needs a real retry of a stored paper in production (R-6); agent traces it in Supabase logs. AXO-131: recommended close as superseded (PR #150 was closed unmerged); you said yes in D5 — agent closes with a comment.

### WP-F — Tutor (L) — Todo, now unblocked by D1
D1 = AI Studio paid tier (no training on your data); declare retention in the policy. Consequence for the agent: the tutor's `STUDENT_CHAT_STRICT` currently admits only `gemini-zdr`, so with `unverified` it refuses every request. The agent must **reconcile policy, config and legal copy** in one change:
1. Add an explicit, honestly named privacy mode for AI Studio paid tier (not "zero data retention"; Google retains abuse-monitoring logs for a period, so we must not claim ZDR).
2. Allow that mode in `STUDENT_CHAT_STRICT`; keep everything else strict.
3. Update the Privacy Policy, Terms and the in-app consent wording to name Google AI Studio paid tier, what is sent, retention, and no training.
4. Tutor-only deploy profile, service binding, per-student daily message and spend caps, deletion parity, staged rollout (internal → beta → GA) exactly as in the earlier spec.
Owner gates: R-5 (secrets, deploy approval) and counsel review of the changed claim (R-11). I will not flip any flag in production.

### WP-G — Model routing and certification (L) — Todo, needs your spend cap (R-2)
As before. Heads-up: AXO-125 says 3.8 Flash price roughly doubles from 1 Jan 2027, so certification evidence should record price table version.

### WP-H — Learning loop (M) — audit first
As before. You said "leave it all" for D2; consent wording stop-gap (stop asking for `improve_extraction` until the loop is verified live) is still agent-doable and recommended.

### WP-I — Database security (M) — Todo
AXO-54 (grants, search_path, SECURITY INVOKER only with tests), AXO-55 (leaked-password toggle: **now needed**, because email/password stays — R-10), AXO-111 and AXO-105 verify-and-close. Postgres upgrade (AXO-112) **deferred until a major upgrade**; agent records that and closes as "won't do now".

### WP-J — Guardian verification (L) — parked by D2
No provider work. Keep server half as-is. Agent task: make sure no copy anywhere says a guardian is "verified" while only "declared" exists.

### WP-K — Legal (M) — drafts only
Rewrite claims to match D1 (AI Studio paid tier; retention declared), D6 (billing grace, refund wording if any), D11 (sign-in methods), D12 (no limit — state it plainly or say nothing). Check what #178 already changed vs the patch. Counsel decides; entity (currently an individual) and India data-residency stay open.

### WP-L — Observability / performance (M)
AXO-78 live proof needs a session (R-8). AXO-67 asset/font/scanner main-thread report; scanner cost needs a device.

### WP-M, WP-O, WP-P, WP-S, WP-T — unchanged.

### WP-U — Billing (new, from D6) (M) — Todo
- 1-day grace period after a failed or lapsed payment before access changes; the guardian sees the grace state and the exact end time; no dark patterns.
- Both INR and USD price options; choice stored per guardian; display currency never silently converts.
- Needs your payment provider details and plan IDs (owner). Agent builds the state machine and UI with a test provider only; no live charges.

### WP-V — Auth (new, from D11) (M) — Todo
Google OAuth + email/password both. Email/password requires: leaked-password protection on (R-10), sensible password rules, a clear recovery path, and **no account creation by me** during tests. Update `CLAUDE.md`. Add tests for both paths and for linking a Google identity to an existing email.

### WP-N — Scanner and release acceptance (L) — see section 4
Device trials stay owner-only. The scanner redesign below is a proposed replacement for the current screen, **not yet approved**.

---

## 4. The scanner: why you hate it, and what I would do

### What is wrong (from `Scan.tsx`, `scanner.css`, `CameraLevel`, `ReviewSheet`, and the code-level review)
1. **Everything floats over the live video**: hint pill, Auto dot, drafts icon, link and upload buttons, exit, level line, drafts toast. The paper — the one thing that matters — has eight things on top of it.
2. **Wrong hierarchy**: exit is a ~38 px button top-right (hardest corner to reach, below the 44 px floor); "Auto" is a small dot; links and uploads sit beside the shutter, where a thumb goes by accident.
3. **Glass pills over live video** cost GPU on mid-tier Android and violate the "transform and opacity only" budget for a screen that must hold 60 fps.
4. **No recovery story**: if live tracking never locks, nothing tells the student and nothing offers a fallback.
5. **Progress is unclear**: captured pages are small tray thumbnails; the "read this paper" action appears only after the fact.
6. **It contradicts its own docs**: `CLAUDE.md` says no in-app camera in v1 ("phone camera apps are better than anything achievable in a PWA").

### The decision only you can make (D16)
- **Option A — Quieter camera (recommended to try first).** Keep the detection engine; replace the screen as in `docs/design-preview/scanner.html`: camera shows only page corners; guidance in a strip *under* the camera; close top-left; Auto | Manual switch; page stack + a fixed "Done · N"; imports/links/drafts in one "More" sheet; after 6 s without a lock, offer "Take a photo instead" and find edges on the still; laptops get an import-first screen.
- **Option B — Native camera + in-app crop.** Drop live tracking. The student uses the phone's own camera app (or the file input with `capture`), then crops and deskews on the still. Simplest, most reliable on budget Android, matches `CLAUDE.md`'s original thesis, and removes most of AXO-45/46/47/48/114's device-trial burden. Loses the live "auto-capture" feel.
- **My recommendation:** build A's screen, but ship **B as the fallback and as the default on devices that fail a quick capability check**. If real-device trials (R-7) show A's tracker is unreliable, B becomes the product with little rework. Do not tune the tracker further until a real phone trial exists.

The mock (8 states: finding, locked, captured, retake, pages, more, won't-lock, laptop) is a static page using the app's tokens with a placeholder instead of a camera. Open `docs/design-preview/scanner.html`; I checked its rendering at desktop width but have not tested it on a phone.

### Scanner build steps (if you pick A)
1. Rebuild `Scan.tsx` layout and `scanner.css` per the mock; keep `src/scan/*` untouched.
2. Remove backdrop blur from the live screen; solid surfaces only.
3. Add the "won't lock" timer and still-photo edge finder, with tests using the golden harness.
4. Move imports/links/drafts into the "More" sheet; make "Done · N" the single exit.
5. Laptop breakpoint → import-first screen.
6. Tests: component tests for each state, axe, 44 px targets, reduced-motion; **no claim about real-device performance without R-7 data**.

---

## 5. Decisions still open (new)

| # | Decision | Recommendation |
|---|---|---|
| D15 | Is `date_taken` the exam date or the upload date? | Add a separate optional `exam_date` the student can confirm; label the current one "Added" until then |
| D16 | Scanner direction (section 4) | A with B as fallback |
| D17 | Is 15 Oct a "private beta of the core loop"? | Yes |
| D18 | Should Done in the scanner go straight to reading, or stop on a pages review? | Straight to reading; the page stack is the review |
| D19 | Laptop: import-first screen, or still try the webcam? | Import-first |

---

## 6. Owner checklist (what is left that only you can do)

Order of importance for 15 Oct:
1. **R-7 real-device scanner trial** (one low-end Android, one mid, one iPhone Safari): 10 captures each on the same real paper. Without this the scanner stays unproven whatever the code does.
2. **R-8 signed-in production walkthrough**: sign in, upload a real paper, open the new overview, mint and revoke a share link. I can drive your signed-in Chrome if you sign in first; I will not type passwords.
3. **R-6 / R-9**: a real marked paper (and the matching screenshots from 2 Oct) for the extraction audit and Pipeline close-out.
4. **R-5**: tutor secrets and deploy approval, when you want the tutor beta.
5. **R-10**: turn on leaked-password protection (needed now because email/password stays).
6. **R-11 counsel**: the changed legal claims (AI Studio, retention, billing). Nothing legal is published without this.
7. **Payment provider**: plan IDs and a test key for WP-U.
8. R-3 check and R-12 (parked).

Deferred by you: Postgres upgrade, guardian provider (D2).

---

## 7. Advice

- **The scanner is the product's weakest and most expensive part.** Every unfinished device-acceptance issue (AXO-45, 46, 47, 48, 114) exists because live tracking is hard to make reliable on budget phones. Option B removes that whole class of risk. Make the decision with one real phone in your hand, not with more code.
- **Do not widen scope before 15 Oct.** The core loop (scan → read → explain → review) plus honest counts is the beta. The tutor, billing, and guardian verification are each their own risk; ship them behind flags or later.
- **Trust the counts only after one real paper agrees on three screens** (Library row, overview, Needs-your-eyes). That is the cheapest, most convincing test of AXO-122.
- **Be careful with "no data training"**: AI Studio paid tier does not train on your data, but it is not zero retention. The policy must say so in plain words; "zero data retention" would be a false claim.
- **Your own screenshots and shared links are the best test material.** Share tokens are bearer links; revoke them after use, and do not paste them into tickets.
- **Keep Linear honest.** Several issues were closed then reopened; the pattern is "merged ≠ done". The `BLOCKED-ON-HUMAN:` comments I add are the quickest way to see what is really waiting on you.
- **Next 48 hours I would do:** pick scanner direction (D16), do R-7 on one phone, turn on the leaked-password toggle (R-10), and send me one real paper (R-6).

---

## Appendix — Appendix A of the earlier spec (76 issues → WP map) remains valid. New mappings: AXO-135/137 → WP-C (partly built); billing → WP-U; auth methods → WP-V.
