# Academic content and truthful review audit — 3 October 2026

## Scope and evidence boundary

This report covers the existing academic display paths and nonvisual review-state fixes for AXO-122, AXO-138, AXO-139, AXO-140 and AXO-142 in the adopted agent specification. It does not approve or implement the AXO-134 visual redesign; AXO-135–137 still require that design checkpoint.

Baseline source inspected: Axon-Site commit 191e3057427b58a0284e76802512b47b96aaf5ec. Changes are prepared on the isolated branch codex/spec-execution-2026-10-03. No student answer, teacher mark, question_label or canonical identity is historically rewritten by these display fixes.

Read in full: AXO-132 and children AXO-138/139/140/142; AXO-122 and its comments; related AXO-119/120 and their server-first review-reentry requirements. Findings were recorded in Linear before code changes.

## Findings and implemented corrections

| Issue | Observed source defect | Draft correction | Limit |
| --- | --- | --- | --- |
| AXO-142 Home | Added unsure saved attempts, historical unreadable page rows and pending papers into one count of “things”; asserted that analysis could not move on; generic Review now destination. | homeAttention keeps units separate. A live current review opens that actual paper. Historical unreadable source pages open the affected saved paper; system processing and technical failures have their own copy. Cached/failed status cannot advertise live action eligibility. | Saved unsure attempts currently have no correction action in QuestionDetail. They are described as uncertain/excluded evidence, with an inspect action, rather than demanding an impossible confirmation. A future saved-attempt correction route needs its own accepted contract. |
| AXO-122 review lead | loadReview described all region rows as questions. Unknown labels invented Question N from order_index. | Reuses the existing countQuestions contract for logical questions, parts and unassigned parts. Unknown labels are Unassigned part. Stored labels are unchanged. | No newly processed deployed run or postdeployment UI capture is claimed here. |
| AXO-142 confirmation | Confirmed unsure/unreadable rows were counted as still needing eyes and kept attention styling. | Pending counts filter confirmed rows; confirmed cards move after pending cards and display confirmation. Unreadable source evidence remains intact. | Confirmation does not reconstruct unreadable content or repair a missing page. |
| AXO-142 failures | Five parallel review evidence queries discarded their errors. An unavailable region read could look like an empty completed review. | Reject any evidence-query error before deriving questions/outstanding counts; the existing review-route retry surface receives the failure. | Loading and failure remain distinct from a successful empty response. |
| AXO-139 math | The bare legacy normalizer replaced words inside existing backslashed Greek commands, doubling valid backslashes. Entire multiline working became one math token. | Existing commands bypass legacy word substitution. One bounded display-only escaping boundary repairs recognized historical commands and literal newlines; valid environments preserve row separators. Multiline steps retain order; bare inline fractions preserve surrounding prose; matrix/alignment environments retain their mathematical structure. | Malformed notation remains a faithful source-text fallback. The renderer does not repair incorrect student algebra or guess combinatorial expressions. |
| AXO-140 tables | X/P rows were treated as pipe-separated prose by the raw-answer path. Existing structured answer contract has lines/segments, no table cells. | Shared AcademicText renders the exact two-row X/P distribution and rectangular markdown tables with explicit separators as semantic tables. Fractions reuse MathText; blank cells retain columns; a bounded focusable scrolling container handles width. Review, raw AnswerBlock fallback, detail question text and shared question/answer fields reuse it. | Ragged rows, arbitrary pipe expressions and outcome grids without proven structure remain text. Existing structured segment annotations/source boxes are retained, not discarded to manufacture a table. |

## Academic content path traced

- Worker/model output and persisted original artifacts: not fully inspected in this audit. This is an outstanding AXO-138/141 gate.
- Current committed readPaper fetches student_answer and answer_block separately. answer_block carries ordered lines with working/final_answer/restatement/crossed_out roles, ordered segments, text/LaTeX, annotations, boxes and optional confidence.
- AnswerBlockView preserves those roles and annotations and allows a segment with provenance to highlight its source crop. The raw student_answer fallback now uses the common AcademicText table compatibility layer.
- Current loadReview fetches question text, raw student answer, teacher remark and human mark fields separately; it does not currently consume the structured answer_block. Raw review content now uses AcademicText, whose cells and prose reuse the hardened MathText/SafeLatex boundary.
- QuestionDetail uses the persisted structured answer and source region/page_spans. SharedAcademic receives the existing restricted read-only snapshot and renders its allowed question/answer strings through the same compatibility layer.
- Teacher/model/student roles stay separate. No text is replaced with a correct solution in the student's transcription.

Security remains in the established KaTeX boundary: trust false, throw-on-error, bounded expansion, HTML/MathML output, refused link/HTML/color commands, safe source fallback. React treats ordinary text and table cells as text. Raw HTML is not executed.

## Stored run reconciliation

The established AXO-122 SQL/JS fixture and earlier Linear evidence report run 89c8d7a9-6b07-4c78-9685-544a5a664c26 as:

- 5 logical top-level questions.
- 12 reviewable parts.
- 3 unassigned parts.
- 12 raw regions.

The final database audit reported 14 pages, with structure_failed pages 2, 4, 6, 10, 11 and 13. Six durable rows in public.page_unreadable record those six failed pages separately from question_region; there are no corresponding unreadable question-region placeholders. The 5-question/12-part count therefore describes the extracted scope of an explicitly recorded partial paper. This trace does not prove an accidental silent omission, and the six page-source records are not six pending region confirmations. This report does not treat the source scope as complete or claim the frontend copy changes repair unreadable extraction.

The original “Question 12” combination transcription, the 5(a) outcome grid and the apparent standard-deviation/subpart mixing still require original capture → conditioned artifact → region boundary → raw model response → persisted field comparison. Source inspection must identify the first loss of meaning; a display fix is not evidence that OCR or segmentation is accurate.

## Validation

Added or expanded:

- tests/ui/home-attention.test.ts: eight live/stale/review/unreadable/processing/failed/resolved/profile-filter cases.
- tests/ui/review-summary.test.ts: count units, confirmed unreadable source, unassigned identity and mandatory clean confirmations.
- tests/ui/review-data-errors.test.ts: all five evidence-query errors reject rather than imply completion; confirmed unreadable provenance remains visible.
- tests/ui/academic-content.test.tsx: exact distribution values, semantic row/column headers, fractions, blank cells, markdown rows, ragged/ambiguous/matrix fallback, bounded idempotent escaping and untrusted cells.
- tests/ui/math-text.test.tsx: valid bare backslashes, historical escaped square roots/fractions/newlines, faithful incorrect algebra, matrices and inline prose.

Eight parser/escaping examples were executed in the tool JavaScript runtime successfully, including idempotence and preserved matrix environments. That is a limited pure-helper check, not React/KaTeX/browser validation.

Intermediate GitHub CI run 37102523416 reported 246 passing UI tests and one failure: the new escaped-math test incorrectly searched the full textContent for a raw LaTeX command, which KaTeX intentionally retains in its accessible MathML annotation. Commit 0cae1cbeb9c9f6f35074a05535ac8e88d267fb15 corrected the assertion to require rendered visible HTML, no math-raw fallback and faithful source annotation. Full exact-head CI after the later evidence-error tests is still required.

The local execution shell disconnected and read-only commands hung, so no local Vitest/build result is claimed. Remote CI, build/typecheck, source review, deployment version and deployed visual/noncamera verification remain explicit gates.

The final separate source-reference audit classified all 156 apparent single-region orphan references as synthetic evaluation references, not a genuine production data leak. The remaining finding is a missing source-link hook; no remediation of a supposed leaked production artifact is claimed here.

## Remaining completion gates

1. Exact final-head unit/UI/database/contract/typecheck/build CI.
2. Deployment and live read-only checks across review/detail/share/Home/Library; narrow mobile, tablet/desktop, light/dark, keyboard/focus, zoom and reduced motion.
3. Reload/reentry/retry/profile-switch/stale-response confirmation persistence verification.
4. AXO-138/141 original/raw/persisted evidence trace for the source complaints; keep malformed historical source faithfully visible until a measured compatible producer/reprocessing strategy exists.
5. Structured table/grid producer and per-cell provenance contract if the corpus proves it necessary; evaluate independently from display compatibility.
6. AXO-134 owner design review before AXO-135–137 layout/control/icon implementation.
7. Physical scanner acceptance remains user-owned and open; this report contains no physical-camera claim.

Parent AXO-132 is not complete while these gates or any child acceptance remain open.
