-- AXO-124 (owner decision, 2026-10-02): a paper with no printed total.
--
-- Before: the reconcile worker stored reconciled = false for a paper that simply printed no total,
-- which is a claim of mismatch where there is nothing to compare, and it sent such papers to the
-- adjudicator. Now:
--   · reconciled = NULL ("unchecked") with extraction_run.status_reason_code = 'no_printed_total';
--     false is reserved for a real mismatch or a mark above its maximum.
--   · the paper's total is the sum of the teacher marks Axon read, labelled paper.total_basis =
--     'added_up' (vs 'printed'), and paper.total_partial = true when a question's mark could not
--     be read, so the figure is shown as "at least".
--   · adjudication runs on its own triggers only (backend: adjudicationTriggers()).
--
-- Existing papers are backfilled. A paper that has a mark above its maximum keeps reconciled = false.

alter table public.extraction_run
  add column if not exists status_reason_code text;
alter table public.extraction_run
  drop constraint if exists status_reason_code_is_a_code;
alter table public.extraction_run
  add constraint status_reason_code_is_a_code
  check (status_reason_code is null or status_reason_code ~ '^[a-z0-9_]+$');

comment on column public.extraction_run.status_reason_code is
  'Stable machine code for a non-failure state worth naming, e.g. no_printed_total. Not user copy.';

alter table public.paper add column if not exists total_basis text;
alter table public.paper drop constraint if exists paper_total_basis_known;
alter table public.paper add constraint paper_total_basis_known
  check (total_basis is null or total_basis in ('printed', 'added_up'));
alter table public.paper add column if not exists total_partial boolean not null default false;

comment on column public.paper.total_basis is
  'printed: the paper carries a total and reported_total holds it. added_up: no total was printed; total_awarded is the sum of the teacher marks Axon read.';
comment on column public.paper.total_partial is
  'True when at least one question''s mark could not be read, so total_awarded is a lower bound ("at least").';

-- commit_extraction_run is SECURITY INVOKER and runs in the student's session, which can already
-- update the paper's other total columns under the paper_update_scope policy. Without this grant
-- every commit would fail with "permission denied for table paper".
grant update (total_basis, total_partial) on public.paper to authenticated;

-- ── backfill ───────────────────────────────────────────────────────────────

update public.extraction_run r
   set status_reason_code = 'no_printed_total'
  from public.paper p
 where p.id = r.paper_id and p.reported_total is null;

update public.extraction_run r
   set reconciled = null
  from public.paper p
 where p.id = r.paper_id
   and p.reported_total is null and p.stated_maximum is null
   and r.reconciled = false
   and not exists (select 1 from public.student_attempt a where a.paper_id = p.id and a.marks_awarded > a.max_marks);

update public.paper p
   set reconciled = null
 where p.reported_total is null and p.stated_maximum is null
   and p.reconciled = false
   and not exists (select 1 from public.student_attempt a where a.paper_id = p.id and a.marks_awarded > a.max_marks);

update public.paper p
   set total_basis = case when p.reported_total is not null then 'printed' else 'added_up' end,
       total_partial = exists (select 1 from public.question_region q
                                where q.paper_id = p.id
                                  and (q.confidence_tier = 'unreadable' or q.marks_awarded is null or q.marks_available is null))
 where p.total_awarded is not null;

-- ── commit: label the total it sets ────────────────────────────────────────

