-- ============================================================================
-- AXO-115 — Surface triage subject suggestions in normal Library browsing
-- ============================================================================
-- The Library already reads paper_progress for the latest extraction run. Add
-- only the safe display suggestion that search_library already exposes, rather
-- than pulling the whole tier_routing payload into the browser.
--
-- These columns are appended to preserve CREATE OR REPLACE VIEW compatibility
-- with the existing column order.
-- ============================================================================

create or replace view public.paper_progress with (security_invoker = true) as
select
  r.id            as run_id,
  r.paper_id,
  r.student_id,
  r.status,
  r.status_reason,
  r.started_at,
  r.finished_at,
  (select count(*) from public.paper_page p where p.paper_id = r.paper_id)          as pages_total,
  (select count(*) from public.paper_page p
    where p.paper_id = r.paper_id and p.structure_status = 'done')                  as pages_done,
  (select count(*) from public.question_region q where q.run_id = r.id)             as questions_total,
  (select count(*) from public.question_region q
    where q.run_id = r.id and q.extract_status = 'done')                            as questions_done,
  (select count(*) from public.question_region q
    where q.run_id = r.id and q.needs_review and q.student_confirmed_at is null)    as questions_needing_you,
  nullif(btrim(r.tier_routing #>> '{triage,subject}'), '')                          as suggested_subject,
  nullif(btrim(r.tier_routing #>> '{triage,confidence}'), '')                       as suggested_confidence
from public.extraction_run r;

grant select on public.paper_progress to authenticated;

comment on view public.paper_progress is
  'Latest-run progress source for the client. Includes only the triage subject suggestion/confidence needed for tentative Library display; canonical subject identity remains on paper.';
