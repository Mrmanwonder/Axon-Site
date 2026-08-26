-- ============================================================================
-- 0012 · The rest of the paper state machine
-- ============================================================================
-- REVIEW_PIPELINE.md §3 names twelve states; `extraction_status` had eight. The
-- five missing ones are added here rather than by introducing the spec's
-- `paper_status` as a second, competing enum — two enums for one state machine
-- is how a state machine stops being one.
--
-- Alone in its own migration because Postgres refuses to *use* an enum value in
-- the transaction that added it. Everything that references these values is in
-- the next file.
--
-- Mapping, for anyone holding the spec open:
--
--   spec            ours            note
--   ────────────────────────────────────────────────────────────────────────
--   queued          queued
--   triaging        triaging        new
--   structuring     structure       stage 3
--   extracting      content         stage 4
--   reconciling     reconciliation  stage 6
--   adjudicating    adjudicating    new — only reached when §6 fails
--   needs_review    needs_review    stage 9
--   explaining      explaining      new — stage 8, and it runs *after* review
--   ready           ready           new — explained, not yet written to attempts
--   committed       committed       stage 10
--   rejected        rejected        new — triage says this is not a graded paper
--   failed          failed
--
-- `attribution` (stage 5) has no spec counterpart and stays: it is a real state
-- the pipeline occupies, between reading questions and binding marks to them.
-- ============================================================================

-- Each anchor is a value that already existed before this migration, so none of
-- these statements reads a value another one just added.
alter type public.extraction_status add value if not exists 'triaging'     after  'queued';
alter type public.extraction_status add value if not exists 'adjudicating' after  'reconciliation';
alter type public.extraction_status add value if not exists 'explaining'   after  'needs_review';
alter type public.extraction_status add value if not exists 'ready'        before 'committed';
alter type public.extraction_status add value if not exists 'rejected'     before 'failed';
