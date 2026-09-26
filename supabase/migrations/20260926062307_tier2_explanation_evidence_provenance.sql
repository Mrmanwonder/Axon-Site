-- Persist immutable evidence identities for every Tier-2 explanation.
-- Tier 1 must carry no scheme provenance; Tier 2 must carry a complete chain.

alter table public.region_explanation
  add column if not exists assessment_identity_id uuid
    references public.assessment_identity(id) on delete restrict,
  add column if not exists scheme_document_id uuid
    references public.scheme_document(id) on delete restrict,
  add column if not exists canonical_question_id uuid
    references public.canonical_question(id) on delete restrict,
  add column if not exists scheme_retrieval_mode text;

alter table public.region_explanation
  drop constraint if exists region_explanation_scheme_retrieval_mode_valid,
  drop constraint if exists region_explanation_tier2_evidence_complete;

alter table public.region_explanation
  add constraint region_explanation_scheme_retrieval_mode_valid
    check (
      scheme_retrieval_mode is null
      or scheme_retrieval_mode in ('exact_label','ancestor_label','scoped_text')
    ),
  add constraint region_explanation_tier2_evidence_complete
    check (
      (
        tier = 'tier_1'
        and scheme_source is null
        and scheme_version is null
        and assessment_identity_id is null
        and scheme_document_id is null
        and canonical_question_id is null
        and scheme_retrieval_mode is null
      )
      or
      (
        tier = 'tier_2'
        and scheme_source is not null
        and scheme_version is not null
        and assessment_identity_id is not null
        and scheme_document_id is not null
        and canonical_question_id is not null
        and scheme_retrieval_mode is not null
      )
    );

create index if not exists region_explanation_assessment_identity_idx
  on public.region_explanation(assessment_identity_id)
  where assessment_identity_id is not null;
create index if not exists region_explanation_scheme_document_idx
  on public.region_explanation(scheme_document_id)
  where scheme_document_id is not null;
create index if not exists region_explanation_canonical_question_idx
  on public.region_explanation(canonical_question_id)
  where canonical_question_id is not null;

comment on column public.region_explanation.assessment_identity_id is
  'Exact assessment identity used for a Tier-2 explanation. Null for Tier 1.';
comment on column public.region_explanation.scheme_document_id is
  'Immutable official scheme document used for a Tier-2 explanation. Null for Tier 1.';
comment on column public.region_explanation.canonical_question_id is
  'Exact canonical question/rule used for a Tier-2 explanation. Null for Tier 1.';
comment on column public.region_explanation.scheme_retrieval_mode is
  'How the canonical question was resolved inside the exact assessment scope: exact_label, ancestor_label, or scoped_text.';
