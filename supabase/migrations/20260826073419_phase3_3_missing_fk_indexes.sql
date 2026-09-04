
-- Audit Finding 6: ~15 FK columns with no covering index. Adding now, before
-- Phase 1's smoke test puts real rows next to the seed data (correctness-adjacent:
-- FK joins without an index get slow exactly once a table has real rows).
create index if not exists attempt_concept_attempt_student_idx on public.attempt_concept (attempt_id, student_id);
create index if not exists consent_event_purpose_idx on public.consent_event (purpose);
create index if not exists consent_event_student_idx on public.consent_event (student_id);
create index if not exists extraction_run_paper_student_idx on public.extraction_run (paper_id, student_id);
create index if not exists mark_loss_event_attempt_student_idx on public.mark_loss_event (attempt_id, student_id);
create index if not exists page_unreadable_paper_student_idx on public.page_unreadable (paper_id, student_id);
create index if not exists paper_page_paper_student_idx on public.paper_page (paper_id, student_id);
create index if not exists question_region_canonical_question_idx on public.question_region (canonical_question_id);
create index if not exists question_region_committed_attempt_idx on public.question_region (committed_attempt_id);
create index if not exists question_region_paper_student_idx on public.question_region (paper_id, student_id);
create index if not exists question_region_run_student_idx on public.question_region (run_id, student_id);
create index if not exists region_explanation_region_student_idx on public.region_explanation (region_id, student_id);
create index if not exists region_explanation_run_student_idx on public.region_explanation (run_id, student_id);
create index if not exists student_attempt_paper_tier_idx on public.student_attempt (paper_id, paper_tier);
create index if not exists student_attempt_paper_student_idx on public.student_attempt (paper_id, student_id);
create index if not exists teacher_mark_paper_student_idx on public.teacher_mark (paper_id, student_id);
create index if not exists teacher_mark_region_student_idx on public.teacher_mark (region_id, student_id);
create index if not exists teacher_mark_run_student_idx on public.teacher_mark (run_id, student_id);
create index if not exists upload_paper_student_idx on public.upload (paper_id, student_id);
