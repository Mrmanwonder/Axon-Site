-- Deterministic assessment-resolution contract.
-- Models may transcribe paper header metadata, but only exact database identity
-- resolution is allowed to bind a paper or marking scheme.

alter table public.paper
  add column if not exists assessment_identity_id uuid
  references public.assessment_identity(id) on delete restrict;

create index if not exists paper_assessment_identity_idx
  on public.paper(assessment_identity_id)
  where assessment_identity_id is not null;

alter table public.canonical_question
  add column if not exists question_label text,
  add column if not exists scheme_document_id uuid
    references public.scheme_document(id) on delete restrict;

create index if not exists canonical_question_assessment_idx
  on public.canonical_question(assessment_identity_id);

create unique index if not exists canonical_question_assessment_label_unique
  on public.canonical_question(assessment_identity_id, question_label)
  where assessment_identity_id is not null and question_label is not null;

create index if not exists scheme_document_assessment_ready_idx
  on public.scheme_document(assessment_identity_id, extraction_status);

-- Assessment identities are metadata identities, not semantic buckets. Prevent
-- two rows from representing the same official paper even when nullable fields
-- are involved.
create unique index if not exists assessment_identity_exact_unique
  on public.assessment_identity(
    programme_id,
    subject_offering_id,
    level,
    exam_year,
    session,
    paper_code,
    component_code,
    variant,
    zone,
    assessment_route
  ) nulls not distinct;

comment on column public.paper.assessment_identity_id is
  'Exact stored official assessment identity. Null means unresolved; runtime must not guess.';
comment on column public.canonical_question.question_label is
  'Exact official question/part label within one assessment identity; used for deterministic retrieval.';
comment on column public.canonical_question.scheme_document_id is
  'Official source document that supplied this question marking evidence.';
