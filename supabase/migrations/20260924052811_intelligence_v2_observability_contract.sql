begin;

-- Intelligence Layer v2 separates transport/schema success from semantic
-- success. Keep this operational ledger metadata-only: no raw prompts,
-- answers, paper text, or provider credentials belong here.
alter table public.model_call
  add column if not exists intent text,
  add column if not exists verification_failures jsonb not null default '[]'::jsonb,
  add column if not exists tool_calls jsonb not null default '[]'::jsonb,
  add column if not exists grounding_used boolean not null default false,
  add column if not exists repair_attempted boolean not null default false,
  add column if not exists answer_status text;

alter table public.model_call
  drop constraint if exists model_call_intent_valid;
alter table public.model_call
  add constraint model_call_intent_valid
  check (
    intent is null
    or intent in (
      'direct_answer', 'concept_explanation', 'problem_solving', 'hint',
      'mistake_diagnosis', 'paper_feedback', 'work_check', 'comparison',
      'socratic', 'current_information', 'source_question', 'casual'
    )
  );

alter table public.model_call
  drop constraint if exists model_call_answer_status_valid;
alter table public.model_call
  add constraint model_call_answer_status_valid
  check (
    answer_status is null
    or answer_status in (
      'pending_verification', 'supported', 'partially_supported',
      'insufficient_evidence', 'controlled_failure', 'failed'
    )
  );

alter table public.model_call
  drop constraint if exists model_call_verification_failures_array;
alter table public.model_call
  add constraint model_call_verification_failures_array
  check (jsonb_typeof(verification_failures) = 'array');

alter table public.model_call
  drop constraint if exists model_call_tool_calls_array;
alter table public.model_call
  add constraint model_call_tool_calls_array
  check (jsonb_typeof(tool_calls) = 'array');

-- retrieval_used means retrieval was requested. grounding_used means at least
-- one retrieved result was actually admitted as evidence; historical rows did
-- not distinguish those states, so do not backfill a false claim.
comment on column public.model_call.intent is
  'Canonical tutor intent when applicable; null for scanner-only stages.';
comment on column public.model_call.verification_failures is
  'Structured verifier failure codes/details only; never raw student content.';
comment on column public.model_call.tool_calls is
  'Bounded tool identifiers invoked during the call, without tool payloads.';
comment on column public.model_call.grounding_used is
  'True only when retrieved evidence was admitted into the reasoning context.';
comment on column public.model_call.repair_attempted is
  'Whether the single permitted verification repair pass ran.';
comment on column public.model_call.answer_status is
  'Student-answer lifecycle status, distinct from HTTP and schema success.';

commit;
