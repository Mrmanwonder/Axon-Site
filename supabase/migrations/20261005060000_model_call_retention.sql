-- model_call retention (owner decision, 5 Oct 2026).
--
-- After 30 days a model_call row loses everything that points at a person or a
-- page: student_id, paper_id, image_keys, and the free-text columns that may quote
-- a student's work (error_detail, tool_calls, verification_failures). Stage, model,
-- tokens, cost, latency, attempt, ok, error_code, run_id and region_id stay, so
-- cost and reliability remain measurable and per-run cost sums do not move.
-- After 90 days the row is deleted.
--
-- The day counts live in one row so they can change without a migration. The job
-- runs daily. The price and rollup triggers fire on INSERT only, so this UPDATE
-- changes no cost figure.

create table if not exists private.telemetry_retention (
  singleton   boolean     primary key default true check (singleton),
  strip_days  integer     not null default 30 check (strip_days >= 1),
  delete_days integer     not null default 90 check (delete_days >= strip_days),
  updated_at  timestamptz not null default now()
);
insert into private.telemetry_retention (singleton) values (true) on conflict do nothing;
revoke all on private.telemetry_retention from public, anon, authenticated;

create or replace function private.apply_model_call_retention()
returns table (stripped bigint, deleted bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_strip  integer;
  v_delete integer;
  v_s bigint;
  v_d bigint;
begin
  select strip_days, delete_days into v_strip, v_delete from private.telemetry_retention;

  delete from public.model_call
   where created_at < now() - make_interval(days => v_delete);
  get diagnostics v_d = row_count;

  update public.model_call
     set student_id = null, paper_id = null, image_keys = '{}',
         error_detail = null, tool_calls = '[]'::jsonb, verification_failures = '[]'::jsonb
   where created_at < now() - make_interval(days => v_strip)
     and (student_id is not null or paper_id is not null or cardinality(image_keys) > 0
          or error_detail is not null or tool_calls <> '[]'::jsonb
          or verification_failures <> '[]'::jsonb);
  get diagnostics v_s = row_count;

  return query select v_s, v_d;
end; $$;

revoke all on function private.apply_model_call_retention() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'axon-model-call-retention';
    perform cron.schedule('axon-model-call-retention', '17 3 * * *', 'select * from private.apply_model_call_retention();');
  end if;
end $$;
