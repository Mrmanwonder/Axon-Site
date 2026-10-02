-- Reconstructed from the production ledger (supabase_migrations.schema_migrations,
-- version 20261001165344) on 2026-10-02: this part of AXO-124 was applied on its own
-- and recorded under this name, but no file carried it. The statements below are the
-- ledger's, verbatim. 20261001170000_axo_124_pipeline_integrity.sql repeats them
-- idempotently (if not exists / drop if exists) before the rest of that migration.

alter table public.question_region
  add column if not exists explain_failure_reason text;

alter table public.question_region
  drop constraint if exists explain_failure_reason_is_a_code;
alter table public.question_region
  add constraint explain_failure_reason_is_a_code
  check (explain_failure_reason is null or explain_failure_reason ~ '^[a-z0-9_]+(:[a-z0-9_]+)?$');

alter table public.extraction_run
  drop constraint if exists failure_reason_is_a_code;
alter table public.extraction_run
  add constraint failure_reason_is_a_code
  check (failure_reason is null or failure_reason ~ '^[a-z0-9_]+(:[a-z0-9_]+)?$');

comment on column public.question_region.explain_failure_reason is
  'Stable machine code for why this region''s explanation failed (e.g. explain_schema_invalid, sweep_timeout:explain). Not user copy. NULL unless explain_status = failed.';
comment on column public.extraction_run.failure_reason is
  'Stable machine code for why the run failed (e.g. structure_write_failed, sweep_timeout:content). Not user copy: status_reason holds that. Never NULL on a failed run written after AXO-124.';

alter table public.question_region
  add column if not exists explain_status_at timestamptz;

update public.question_region
   set explain_status_at = updated_at
 where explain_status_at is null
   and explain_status in ('queued', 'running');

comment on column public.question_region.explain_status_at is
  'When explain_status last changed. The sweep judges stale running/queued explanations from this, not from updated_at.';
