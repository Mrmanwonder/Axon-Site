# AXO-244: student home, practice loop and v1 analytics — build report

Date: 13 Oct 2026. Branch `feat/axo-244-home-practice-analytics`. Covers AXO-245 to AXO-262.
Owner decisions this rests on are recorded on AXO-244 (comment of 12 Oct 2026, 19:06 UTC).

This file is a record, not instructions. It states what exists, what was checked, and what
only a person can finish.

## 1. What was built

**Database** (two migrations, not yet applied to production):
`20261013090000_axo_245_249_error_items_and_tagging.sql` and
`20261013090100_axo_250_262_practice_and_analytics.sql`.

- `error_item`: one row per part that lost marks, derived only from `attempt_analytics` and
  `mark_loss_analytics` (hard rule 3). Re-scanning the same assessment joins the existing item
  (`group_key`), so history is kept and nothing is duplicated.
- Command word: the printed word is read first; the explain stage's tag is the fallback.
- AO and component weight come from the syllabus for 9231, 9618, 9701, 9702, 9708 and 9709,
  with source URL and page. Other codes carry no AO, and the UI says so.
- Mistake type maps the fixed `cause` enum; no new enum value. A blank conceptual gap is
  "not yet learned", a written one is a misunderstanding. `mistake_type_ui` flag: off.
- Ranking (`focus_areas`), `next_best_action`, `due_queue`, spaced scheduling
  (`record_reattempt`), sessions, `reattempt_reveal`, `error_journal`, `scorecard`,
  `topic_readiness`, `grade_outlook` (opt-in) and `progress_summary`. Every one is a
  Student Mode scoped RPC.
- Grade thresholds: `grade_threshold_set` loads as draft; only rows a person marks `verified`
  are readable or used.

**App** (Axon-Site):
- Home in the brief's order: next best action → today's re-attempts → three leaks → journal
  link → progress strip with streak → recent scans → scan prompt. One primary button per
  state. One-time target-grade prompt.
- `/practice/:id`: answer from memory, then reveal (teacher's marks, Axon's explanation,
  grounded worked answer, scheme only where permitted), then the student's own check, then
  the remedy for the item's type, then save. The finish screen offers the if-then prompt,
  which only appears while its flag is on.
- `/insights/journal`: every lost mark, filtered by subject, topic, command word, status and
  mistake type (the type filter only while the flag is on).
- Insights → Practice: a scorecard by command word and AO, topic readiness, and the grade
  outlook. The outlook only appears once the student turns it on in Settings.
- Settings → Target grades: per-subject targets and the "Show grade outlook" switch.

## 2. Evidence

All results below were run on this branch on 13 Oct 2026.

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npx vitest run` | 82 files, 638 tests passed |
| `npm test` | 243 passed |
| `npm run test:db` (PGlite, every migration) | 125 passed, including 17 in `tests/db/practice-loop.test.mjs` |
| `npm run build` (incl. bundle budget) | passed; initial JS 644 KiB raw / 195 KiB gzip |
| Playwright Chromium, full suite | 183 passed. 2 timing tests failed under 4 workers and passed when rerun serially: `performance-production`, and `scanner-viewfinder`, which this branch does not touch |
| `tests/e2e/axo-244-practice-home.spec.ts` | 7 passed: Home at 380, 768 and 1024 px; Insights at 380 and 1024 px; one full practice session |
| `npm run check:contract-parity` | not runnable here (needs a GitHub token); `src/scan/contract.js` is unchanged from main, so CI's run is the real check |
| WebKit project | not run here; CI runs it |

Fixes made during verification:
- Home crashed when a practice RPC returned an unexpected shape. Replies are now validated,
  so a bad reply is a failed read and flags fail closed (`tests/ui/practice-shape.test.ts`).
- A hidden mistake-type leak rendered as "These questions". It now gives way to the next
  real leak.
- A student whose papers were still being read was told to scan a paper. The card now says
  practice starts once a paper is read and confirmed.
- The session summary said "0 got right". It now names only the results that happened.
- The Insights subtitle said "never predicted marks", which stops being true once the outlook
  is switched on. It now reads "Patterns from teacher-marked work. A grade outlook appears
  only if you turn it on."

## 3. Not done, and why

**BLOCKED-ON-HUMAN**
1. **AXO-249: teacher labels.** Agreement can't be measured until a teacher labels about 100
   lost marks into `public.tag_eval_label` (kind `mistake_type`, `labelled_by` = the
   teacher). `private.tag_eval_report('mistake_type')` then reports per-class agreement. The
   owner sets the pass bar (suggested 80%) and switches `mistake_type_ui` on.
2. **AXO-247 and AXO-248: accuracy samples.** The same table with kinds `command_word` and
   `ao`. A person labels a sample; the report gives the accuracy figure the issues ask to
   document. Production holds 7 committed attempts today, too few to sample.
3. **AXO-256: counsel on showing original exam content in re-attempts.** As built, the
   question text the student's own scan produced is shown. Cambridge and Pearson scheme text
   is never shown.
4. **AXO-262: grade thresholds.** None are loaded. Each series' published table has to be
   entered as draft and checked by a person; until then the outlook says no checked
   thresholds exist.
5. **AXO-258: experiment.** The if-then flag is off. Turning it on starts the
   prompt/control split. `private.if_then_report` reads the result.
6. **Real-device check** of Home, practice and Insights at phone size. Automation covered the
   layout only.

**Blocked for the agent: the Axon.md amendment.** The 13 Oct decisions comment says Axon.md
is amended in this PR. The edit was refused by the session's safety check for agent rules
files, so it is not in this PR. Text for the owner to apply:

- §1: replace "Do not add a planner, missions, a digital twin, streaks, or a generic chat
  product." with "Do not add a planner, missions, a digital twin, or a generic chat product.
  The practice loop (spaced re-attempts of lost marks, AXO-244) is part of 'Learn from
  confirmed history' (owner, 13 Oct 2026)."
- §6 Motion: "No mascots, confetti or streaks." → "No mascots or confetti."
- §8: "No streaks, badges, or gamified progress." → "No badges or gamified progress. The one
  exception is the practice streak (owner, 13 Oct 2026): it counts days with a finished
  re-attempt session, never app opens; weekends never break it; freezes cover a missed
  weekday; it compares the student only with their own past."
- §9.7: drop "streaks" from the list of refused defaults.
- §11: add the four 13 Oct decisions from the AXO-244 comment.

## 4. Open product questions for the owner

1. **Gain wording: decided (owner, 13 Oct 2026): "9 marks to win back".** It replaces
   "+9 marks recoverable" on the next-step card, the leaks and the due list, so no "+N" or
   "recoverable" remains on Home.
2. **The scorecard ignores the Insights filters.** It has its own subject picker, and the
   sticky filter bar can sit above it. Recommendation: keep it separate for v1, and say so
   in a one-line note if testers are confused.

## 5. Rollout (done 13 Oct 2026, owner-approved)

1. The CI SQL suite caught five private SECURITY DEFINER helpers that still had the
   default PUBLIC execute grant. Fixed in `901cc65` before anything was applied; the
   authority test now also proves guardian B is refused on every practice RPC.
2. Applied `20261013090000` and `20261013090100` with the repo's own `migrate.yml`
   (workflow_dispatch on this branch; dry run 38334539181 listed exactly these two;
   apply run 38334695326). Ledger versions equal the file versions.
3. Verified on the live project: 12 tables, 19 RPCs, `anon` still limited to the two
   approved functions, the five helpers not executable by any client role, both flags
   off, 28 component rows, 0 threshold sets.
4. Backfill: `private.ensure_error_items` for all 17 live students made 16 error items
   for 2 students, with nothing left dirty.
5. Advisors re-run. New findings: 19 authenticated-definer warnings (the audited
   practice RPCs), `tag_eval_label` RLS-without-policy (service-role only, by design),
   and two unindexed foreign keys, fixed by `20261013100000_axo_244_practice_fk_indexes.sql`.
6. Flags stay off until the human items in section 3 are cleared.
