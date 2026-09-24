begin;

alter table public.model_route
  add column if not exists thinking_level text;

alter table public.model_route
  drop constraint if exists model_route_thinking_level_valid;
alter table public.model_route
  add constraint model_route_thinking_level_valid
  check (
    thinking_level is null
    or thinking_level in ('minimal', 'low', 'medium', 'high')
  );

alter table public.model_call
  add column if not exists thinking_level text,
  add column if not exists retrieval_used boolean not null default false,
  add column if not exists schema_valid boolean,
  add column if not exists verification_status text;

alter table public.model_call
  drop constraint if exists model_call_thinking_level_valid;
alter table public.model_call
  add constraint model_call_thinking_level_valid
  check (
    thinking_level is null
    or thinking_level in ('minimal', 'low', 'medium', 'high')
  );

alter table public.model_call
  drop constraint if exists model_call_verification_status_valid;
alter table public.model_call
  add constraint model_call_verification_status_valid
  check (
    verification_status is null
    or verification_status in (
      'transport_only', 'verified', 'failed', 'insufficient_evidence',
      'conflicting_evidence', 'controlled_failure'
    )
  );

-- Reviewed route policy required by Intelligence Layer v2. Sampling values stay
-- for historical rollback, while Gemini 3.5 behavior is controlled through
-- thinking_level, evidence, tools, and verification.
update public.model_route
set primary_model = 'gemini-3.5-flash-lite',
    fallbacks = '{}'::text[],
    thinking_level = case stage
      when 'triage' then 'minimal'
      when 'structure' then 'low'
      when 'content' then 'medium'
      when 'adjudicate' then 'high'
      when 'explain' then 'medium'
      when 'tutor' then 'medium'
    end,
    allow_training = false,
    prompt_version = case
      when stage = 'explain' then 'paper_feedback.v2'
      else prompt_version
    end,
    updated_at = now()
where enabled = true;

comment on column public.model_route.thinking_level is
  'Versioned reasoning policy. Sampling temperature remains only for legacy rollback and is omitted for Gemini 3.5 routes.';
comment on column public.model_call.thinking_level is
  'Reasoning level actually requested for the call; null only for historical calls.';
comment on column public.model_call.retrieval_used is
  'Whether the call used live retrieval. Public sources are recorded separately from private student inputs.';
comment on column public.model_call.schema_valid is
  'Whether the provider response passed the stage schema before downstream semantic verification.';
comment on column public.model_call.verification_status is
  'Semantic verification outcome when available. transport_only means schema-valid model output still awaits a downstream verifier.';

commit;
