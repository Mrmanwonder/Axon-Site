-- AXO-64 — cover Axon-owned foreign keys reported by the live Supabase
-- Performance Advisor on 2026-09-28.
--
-- These are deliberately single-column leading-key btree indexes. Existing
-- composite indexes that contain the FK only after another column do not cover
-- parent-row delete checks or FK-column-only joins, which is why the advisor
-- correctly continued to report them.
--
-- stripe._managed_webhooks.account is provider-managed and intentionally absent.

create index if not exists student_scope_session_student_id_idx
  on private.student_scope_session(student_id);

create index if not exists assessment_identity_subject_offering_fk_idx
  on public.assessment_identity(subject_offering_id);

create index if not exists canonical_question_scheme_document_fk_idx
  on public.canonical_question(scheme_document_id);

create index if not exists curriculum_stage_programme_fk_idx
  on public.curriculum_stage(programme_id);

create index if not exists scheme_document_policy_fk_idx
  on public.scheme_document(policy_id);

create index if not exists scheme_document_superseded_by_fk_idx
  on public.scheme_document(superseded_by_id);

create index if not exists student_programme_fk_idx
  on public.student(programme_id);

create index if not exists student_stage_fk_idx
  on public.student(stage_id);

create index if not exists student_subject_subject_offering_fk_idx
  on public.student_subject(subject_offering_id);

create index if not exists subject_offering_stage_fk_idx
  on public.subject_offering(stage_id);

create index if not exists subject_offering_subject_fk_idx
  on public.subject_offering(subject_id);
