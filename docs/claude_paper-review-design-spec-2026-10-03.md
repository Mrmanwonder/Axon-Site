# Paper and review design specification — 3 October 2026

Status: proposed; owner review required. Implements the **design deliverable** of AXO-134, not AXO-135–142 or a shipped redesign. Source baseline: Axon-Site main 191e3057427b58a0284e76802512b47b96aaf5ec. The adopted spec explicitly says: “Owner approves the spec before UI work”. This document and docs/design-preview/index.html are the concrete review result for that decision.

## Evidence and scope

Read AXO-132/134/135/136/137 in full, including relations and comments; all seven AXO-132 images were fetched and visually inspected on 3 October. These are observations of the supplied evidence, not proof of current production behavior.

1. Question 12: a 3/3 extraction coexists with uncertainty; grey browser radio circles compete with number tiles; answer reads EE^{4}C^{3}, EEE4 = 4C_{1}, 3 BANC. The tight crop excludes the printed question. Neither styling nor mathematical formatting can establish the intended expression.
2. Full-page reference: printed question, upper combination working, teacher circled 3, list BA/BN/BC/AN/AC/NC are spatially distinct. Preserve access to the complete page; offline comparison cannot prove live scanner accuracy.
3. 5(a): X row 0/1/2/3 and P row 1/4, 3/8, 1/4, 1/8 are flattened into pipes despite a visible table and teacher 3. These exact values are a student-transcription fixture; this spec does not certify OCR correctness.
4. Standard-deviation example: raw sqrt/frac and literal newline escapes appear; subsequent mean/c working seems merged with the earlier part. Render existing working faithfully and flag unresolved boundaries. Never move working to a guessed parent.
5. Share/Delete: large outlined circles and heavy icons compete with academic content.
6. Class test: date 7 September 2026, 19/27, “9 of 9 parts marked”, rows 1(a)(i)/(ii)/(iii), c/d/b and 2(a). A bare part lacks verified parent context. No question prompt is visible.
7. Six “things need your eyes” while the detailed row says 0 to confirm / 6 unreadable / 0 ready. Unreadable recovery and field confirmation are different actions.

The preview deliberately distinguishes **Screenshot fixture**, **Axon-authored layout example**, **Unverified transcription** and **Illustrative evidence placeholder**. It contains no student identity, auth/session, share token, actual source image, marking scheme, or production model call. Do not cite it as a processed paper or real camera run.

## Current source inventory

| Surface / route | Verified source | Data and current limitation |
|---|---|---|
| Library /library | src/ui/pages/Library.tsx; data/paperPresentation; AppProvider | Papers, progressResource and private search results; already distinguishes verified/suggested subject. Reuse these distinctions. |
| Paper /library/:paperId | src/ui/pages/PaperOverview.tsx; usePaperResource | student_attempt supplies marks, question_region supplies evidence; currently title is paperTypeLabel, flat attempt rows, no stem preview. |
| Part /library/:paperId/:qId | src/ui/pages/QuestionDetail.tsx | Stable attempt id; question_region.committed_attempt_id + page_spans provide Crop evidence. MathText, AnswerBlock and WorkedAnswer exist. Correcting committed answers is not an established save path: do not invent one. |
| Review /scan/review/:draftId | src/ui/pages/PaperReview.tsx | Server-resumable via ScanProvider; processing/stopped/committed/gone states already distinct. Preserve re-entry without local IndexedDB draft. |
| Review overlay | src/ui/scan/ReviewSheet.tsx; ScanProvider | ReviewQuestion, onMark, onAction, onSave. Current q.confirmed is broader than the proposed field confirmations. Contract change is required before field-scoped UI promises. |
| Recipient /share#token=… | src/ui/pages/SharedAcademic.tsx; src/shares.js | resolve_academic_share allow-listed snapshot; read-only, revoked/expired/failed/loading. MathText already reused. Do not add raw page/crop to public shares without changing reviewed privacy contract. |
| Actions | src/ui/components/ResourceActions.tsx; useAcademicShare; SheetProvider | Already restyled in #178 with compact local SVGs. Replace assets in this existing component after approval, not a competing icon framework. Preserve authenticated ownership checks, share scope/expiry/revocation and the consequence sheet. AXO-98 removed the redundant paper/question Parent Mode prompt. |
| Academic rendering | components/MathText, AnswerBlock, WorkedAnswer, Crop | Consolidate normalization/content rendering in these primitives; review currently uses lazy MathText and needs structured answer support. |
| Addresses | src/ui/app/paths.ts | Use existing builders and ?sheet overlay convention; stable ids, scroll restoration and Back behavior persist. |

Remote GitHub source was read when the Windows execution transport became unavailable. This is source inspection, not browser verification.

## Reading order and responsive arrangement

**Overview:** Library breadcrumb → paper identity and metadata → compact marks-lost/coverage summary → actual next action → grouped questions → unassigned parts → read-only explanation detail.

**Review:** paper breadcrumb → full question path and prompt/shared context → page/crop evidence → extracted student working → teacher mark/comment → named uncertainty → field-specific save/confirm action. Source remains inspectable from every field.

At 360–767px: one reading column, 16–18px side gutters, no fixed-width academic content; title wraps, toolbar moves to its own row if necessary. Question rows show full path on one line if space permits, a readable prompt next, then mark and state. No truncation of identity. Actions wrap; primary action stays in DOM flow above the app dock. Source is above working, with an explicit full-page button; normal image fit is contain.

At 768–1023px: existing 76px nav rail remains untouched; preview uses an intrinsic review grid using repeat(auto-fit,minmax(min(100%,300px),1fr)); it uses two columns only when both fit, including at zoomed effective widths. At 1024px+: existing 216px labeled rail remains untouched; overview content capped at 920px, reading text at 68ch, review source and field stack in adjacent columns within a 1080px cap. DOM reading order is identical in both layouts. Source can be pinned within the reading grid, never allowed to hide prompt or steal keyboard scroll. The preview does not reproduce the displacement-map nav; production retains the existing nav.

Annotated preview callouts A–F identify identity, coverage, actual next action, groups, source and field confirmation. The controls expose overview, review, table, math, unreadable, completed, missing identity, loading, failed and empty states; dark/light and large-text switches allow comparison.

## Tokens and shared components

Use src/ui/styles/tokens.css directly. Onest is the existing self-hosted public/fonts/onest-latin-var.woff2, 400–700, font-display swap. Existing dark/light --bg, --surface, --label, --label-2, --accent, --attention and --hairline remain the vocabulary. Scoped preview text roles are derived, without changing production tokens: --review-secondary mixes --label 74% with --bg; light --review-link mixes --accent 84% with --label for readable small links. The original light accent alone yielded 4.01:1 on the page background in actual axe results. No external font request. Preview imports the stylesheet relative to the repository; serving the repo root supports that link.

| Role | Final proposal |
|---|---|
| Spacing | 8px rhythm; mobile gutter 16–18px; section gap 24–32px; row padding 16px; field gap 16px |
| Reading body | 16px, line-height 1.55; labels 13px using a scoped --review-secondary derived from --label/--bg for stronger contrast, never --label-3 for required instructions |
| Paper title | Existing --fs-h1 27–34px; full question title 21–24px |
| Marks | 22px summary; 16–18px rows; maximum 28px everywhere; tabular numerals |
| Surface | One group boundary; field separators inside, no redundant nested large cards |
| Targets/icons | Minimum 44×44px target; 20–24px glyph; 8px gap |
| Focus | Existing --focus-ring and --focus-offset; visible on every interactive element |
| Confidence | Confirmed solid fill; likely light fill+border; unsure dashed outline; explicit state text |
| Attention/destruction | Amber for unreadable/save errors and Delete; red remains sign-out only (real red pen stays inside source evidence) |
| Motion | Existing state/disclosure durations; transform/opacity only; reduced-motion honored; no decorative scan animation |

Proposed reusable primitives are PaperIdentity, CoverageSummary, NextRequiredAction, QuestionGroup, PartRow, SourceEvidence, AcademicContent, TeacherMarkControl, FieldConfirmation and ResourceActions. These are design responsibilities, not instructions to duplicate already-existing components. Consolidate in existing primitives where possible.

## Identity, hierarchy and counts

Metadata is shown only with source/provenance. Priority: verified meaningful title → subject + paper kind → honest “Class test” / “Paper”. Show school/session/component/variant/code only when stored and verified. Programme from profile does not establish exam identity. Exam date and upload date are separately labeled; missing date says “Test date not recorded”. A suggested subject says “Subject suggested: …”; unknown says “Subject not confirmed”. An Edit details affordance only ships after its authorized persistence route is implemented.

Question grouping consumes AXO-122's shared count/normalization projection; never reparses labels independently in components. Valid display variants 1b and 1(b) may share Question 1; bare b/c/d stay “Unassigned part (c) · Page …” without verified source order/boundary evidence. No lexical 10-before-2 sorting. Shared stem is shown once; exact part prompt separately. Cross-page continuations keep stable region/attempt ids and page references.

Counts mean exactly questions_total (top-level), parts_total (leaf parts), unassigned_parts and raw_region_count. Unknown parents never become extra synthetic question numbers. Nine marked parts do not establish nine top-level questions. For the pictured Class test, the preview preserves 19/27 and nine marked parts as a screenshot summary fixture, **does not invent the missing three rows**, and labels the visible subset. The seven-image evidence does not establish a canonical question count.

Use “Marks lost” for the headline, as CLAUDE.md requires. The example can say “8 marks lost · teacher's total 19 of 27 · 9 of 9 parts marked”, with the ratio secondary and clearly sourced. Partial totals say “At least … marks lost from … scored parts”; unreadable/missing mark is not zero. All totals exclude parent/child duplication and unsure/unconfirmed analytics rows. If coverage or source is uncertain, do not infer a finalized total.

## Truthful next-action decision table

| Data condition | Heading / destination / count |
|---|---|
| unresolved fields > 0 | “Check N parts” → first actually unresolved part; separate field list under each part |
| unreadable > 0, confirmations = 0 | “N parts couldn't be read” → list those parts and source/retake recovery; no generic “Review now” |
| unreadable records with no user recovery operation | State “N parts couldn't be read”; source available; Retry only if server supports it; no count of user tasks |
| unresolved and unreadable both > 0 | Two explicit categories and destinations; one part with multiple fields counts once in part total |
| clean parts await explicit whole-part confirmation | “N parts ready to check” → clean subset; state exactly what batch confirmation covers |
| saving / processing | “Saving…” / current server stage; aria-busy; no invitation to review unready items |
| no action, explanations queued | “Your checks are saved. Explanations are being prepared.” |
| committed | “Review complete”; no amber attention banner; Open paper |
| error / stale | Concrete failure + Retry, or “Offline copy · updated …”; preserve known data, never replace a failed read with zero |

Matching record ids, type and available action must accompany each counter. Navigation is to the exact part/page, not a general scanner landing screen. Read-side state only; no database rewrites to make display counts agree.

## Review and teacher-mark contract

Every field carries origin and state: teacher mark read from paper, student's correction of that reading, unconfirmed extraction, unread data, and Axon suggestion. “Teacher's mark” never means Axon assigned a mark. A whole-part state cannot masquerade as confirmation of each field.

Small known integer maximum (0–8): visually hidden native radios and one numbered tile per value; name is stable by region id; group accessible name “Teacher's mark, out of 3”. Selected candidate is explicitly “Read as 3 — not confirmed” until human confirmation. Do not default unread to zero. Native arrow-key behavior retained, focus shown on tile, check/tile fill makes selection discernible without colour.

Known maximum >8: bounded numeric entry with min 0, max allocation, integer validation; show maximum nearby. Unknown maximum: entry says “Maximum not read”; verify the maximum separately; never fabricate options or validation ceiling. Non-integer unread allocations keep their original text in source and expose recovery, no rounding.

Required examples: confirmed 0/2, confirmed 3/3, candidate 3/3 unconfirmed, unread mark, no selection, unknown maximum, and 40-mark input. Mark selection creates an unsaved **mark draft**, not whole-part confirmation. “Confirm teacher's mark” saves only that field; uncertainty in answer/question identity remains. “Save transcription” saves only answer edit. “Confirm all fields in this part” is available only with an explicit list of fields and no unresolved gap; no bulk accept of unreadable items.

The existing ReviewQuestion q.confirmed/onMark/onAction contract must be audited with backend_spec before implementation; do not promise field-scoped persistence using a client-only flag. Until its schema/RPC supports the proposed model, the preview remains an interaction proposal.

Actions: “Fix this transcription”, “Change teacher-mark reading”, “Correct question label”, “Retake page N”, “View full page”. “Not why I lost it” immediately rejects a diagnosis and excludes it from analytics. A dispute about the awarded mark directs the student to the teacher; it never opens model adjudication.

Unsaved → Saving → Saved only after durable acknowledgment. Failure → “Couldn't save. Your changes are still here.” + Retry, draft retained. Failed field-save cannot decrement counts. Successful save removes only resolved warning and updates count from acknowledged state. Background refresh/profile switching cannot save the previous student's draft into the new profile. Back from edited data opens Save draft / Keep editing / Discard draft choices with consequences; source inspection doesn't discard drafts. Offline: saved paper readable; no model queue; correction says “Connect to save” and retains draft according to existing draft privacy policy.

## Academic content, sources and explanations

AcademicContent delegates math to existing MathText/KaTeX and tables to existing AnswerBlock; shared rendering/normalization reused on Review, overview previews, detail, learning and recipient surfaces. Keep source text plus structured blocks. Normalize proven escaped newlines/delimiters conservatively; do not infer the semantic meaning of malformed EE^{4}C^{3}, alter arithmetic or “fix” student errors. Such text stays “Transcription needs checking”, with raw text/source and correction.

The SD fixture displays the screenshot expression faithfully, including a separate “160” line and later 642/60 = 10.7; it explicitly says “Part boundary not confirmed”. It must not transform the student's expression into a correct formula. An Axon-authored renderer example may show a well-formed fraction/root, labeled separately. Scrollable math has tabindex=0, an accessible expression label and the token focus ring so keyboard users can reach its overflow. A failed math parse renders escaped readable text and “Notation couldn't be displayed”; the source stays available. No HTML injection or arbitrary KaTeX trusted commands.

The X/P table fixture renders genuine HTML table with caption and row-header th scope=row, numbers in separate cells; keyboard scroll only when wider than available space. Matrix notation is a separately typed structure, not any pipe-containing paragraph. Ragged/missing cells remain visible and flagged; blank not zero; decimals/signs/superscripts retained. Entire student table stays selectable/copyable. Do not convert table extraction failure into a plausible reconstructed table.

SourceEvidence offers answer crop, relevant prompt/teacher-mark crop and full original page with page number and provenance. Tight answer crop cannot be the only source when printed stem is missing. Zoom has labeled controls and keyboard accessibility; close returns focus. No fabricated placeholder image called “Original page”. In preview, the paper-shaped figure is prominently an **illustrative placeholder**, because browser source storage and rendering are not verified.

Learning feedback follows teacher facts. Label “Axon's explanation”, with basis “Teacher's mark and remark” or exact stored scheme source/version. No “verified explanation” badge or scheme claim from absent data. Withheld corrected working says why; no generic advice. Tutor entry stays behind the current flag and rollout gates. Public share retains its allow-listed read-only contract.

## Icons

Recommendation for owner approval: Google Material Symbols Outlined, static SVG subset, optical size 24, consistent standard weight, currentColor. Google official guide and upstream LICENSE were read on 3 October:
- https://developers.google.com/fonts/docs/material_symbols
- https://github.com/google/material-design-icons/blob/master/LICENSE

They are Apache-2.0 licensed. Include upstream license and notices with distribution. Preview embeds the exact official share_24px and delete_24px assets, with full licence text in an HTML source comment; no icon-font or external font request. This demonstrates the proposed web family; it does not silently settle the owner's icon decision or change production ResourceActions. Other preview controls use text labels. Extend the same family to back, chevrons, edit, rescan, zoom and state only after owner acceptance. Delete remains amber/neutral and consequence-sheet behavior is retained; sharing remains authenticated owning session → visibility/expiry sheet → mint → copy/second-tap share. AXO-98 explicitly removed redundant action-time Parent Mode; this supersedes the outdated Parent Mode instruction in WP-D/AXO-89. No parent-code prompt is reintroduced. Draft PR #187 extends automatic copy with explicit native/manual fallback; treat it as proposed until exact-head CI and deployment proof.

## Interaction state inventory

| State | Required visible and accessible treatment |
|---|---|
| Normal | Text and bounded target, readable metadata |
| Hover | Existing wash, no shift or enlarged glyph |
| Focus | Token ring on tile/button/link, never clipped |
| Selected | Solid tile + visible selection cue + native checked |
| Disabled | Reason next to disabled action; no ghost active toolbar |
| Busy | Action-specific “Saving…”; aria-busy; duplicate submission blocked |
| Success | Field “Saved”, polite announcement; acknowledged counts only |
| Error | Amber text + concrete retry; preserved draft; no red |
| Loading | Skeleton with accessible loading label; no fixture numbers |
| No questions | “No readable questions yet”; actual failed/source state retained |
| Missing identity | Honest fallbacks + persistence-gated correction action |
| Completed | No action banner; saved fact origin; open paper |
| Offline/stale | Explicit offline timestamp; saved content usable, save online-only |
| Recipient expired/revoked | Unavailable-link state, no previous snapshot flash |

## Complaint-to-component acceptance map

| Original complaint | Implementation owner | Required later test / evidence |
|---|---|---|
| Selector/malformed Q12 | TeacherMarkControl + AcademicContent; AXO-136/138/139 | 0/2, 3/3, unread, unconfirmed, unknown max, 40; keyboard/touch; don't “repair” EE string |
| Scanner reference | SourceEvidence; AXO-141/114 | Offline original/conditioned/crop comparison; physical tests explicitly separate |
| X/P flattened table | AcademicContent/AnswerBlock; AXO-140 | Exact screenshot values/cell order, ragged table, source view, narrow viewport |
| Raw math/merged SD | MathText/normalizer; AXO-138/139 | Root/fraction/newline fixture, unknown part boundary stays unresolved, parse fallback |
| Share/Delete icons | Existing ResourceActions; AXO-137 | Actual SVG asset/licence, 44px targets, current authenticated ownership/share-scope/consequence actions |
| Flat paper list | Identity/QuestionGroup/PartRow; AXO-135 | Full paths, unassigned c/d/b, date fallbacks, known vs missing counts, Back restoration |
| Non-actionable attention | NextRequiredAction; AXO-122/142 | 0 confirm/6 unreadable/0 ready fixture; exact recovery destinations; zero-action state |

## Review result, verification limits and next step

Available result: this concrete specification and interactive responsive preview. Screenshot totals are fixtures only. Source inventory and all seven source images were inspected. HTML is static and changes no production interface or authentication/storage. The Windows execution transport failed during this task; a targeted browser harness is now in tests/e2e/design-preview.spec.ts and runs through existing PR CI. It serves the preview, local tokens and font through an isolated route fixture and checks all ten states at five widths in both themes, with screenshots, axe, target heights, runtime errors, keyboard radio selection and failed-save draft retention. A 200% CSS-zoom case is explicitly a proxy, not physical/browser-device proof. **Actual CI results, screenshots, mobile viewport overflow, axe accessibility and real-device evidence have not yet been inspected or marked passed**. Do not mark their acceptance as passed.

Before owner review is considered complete, run preview in Chromium at 360/390/768/1024/1440 widths, both themes, 200% zoom and keyboard-only; capture overview/review/table/math/unreadable/completed views; run axe, check no horizontal document overflow and 44px targets. These are design-fixture tests, never physical scanner proof. No production UI work, final AXO-134 completion, or child release claim until owner explicitly approves the design result. Remaining production requirements and counters stay open in AXO-135–142.


### Actual CI rendering and corrections

Run [37103028693](https://github.com/Mrmanwonder/Axon-Site/actions/runs/37103028693) rendered the fixture and found eight failures: light breadcrumbs at 4.01:1 contrast, MathML scroll regions lacking keyboard access, and 200% CSS-zoom overflow (Chromium 122px / WebKit proxy 165px at 360px). 36 other E2E rows passed; core/typecheck/build/UI/DB checks passed. Corrected actual preview roles, focusable math, intrinsic columns and shrinking/wrapping controls/source content in commit 32160f98cab8f6dbefa06d9131a14dbde8bffcc1. Strict tests remain unchanged. Updated exact-head CI result and visual screenshot inspection remain pending; nothing is certified from the failed run.
