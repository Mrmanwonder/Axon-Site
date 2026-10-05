-- ============================================================================
-- Test suite: model_call retention (strip at 30 days, delete at 90)
-- ============================================================================
-- Rolls back; safe against any database.
--   Run:  psql "$DATABASE_URL" -f supabase/tests/model_call_retention.sql
--   Pass: no row in public._r has passed = false.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

-- Pin the day counts so the test does not depend on the live row.
update private.telemetry_retention set strip_days = 30, delete_days = 90;

insert into public.model_call (id, run_id, paper_id, student_id, region_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens, image_keys, error_detail, tool_calls, verification_failures, created_at)
values
 (-1, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'explain', 'm', 'm', 'p.v1', true, 100, 10,
  array['k/a.jpg'], 'quoted text', '[{"q":"x"}]'::jsonb, '[{"quote":"y"}]'::jsonb, now() - interval '31 days'),
 (-2, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'explain', 'm', 'm', 'p.v1', true, 100, 10,
  array['k/b.jpg'], null, '[]'::jsonb, '[]'::jsonb, now() - interval '5 days'),
 (-3, null, null, null, null, 'explain', 'm', 'm', 'p.v1', true, 100, 10,
  '{}', null, '[]'::jsonb, '[]'::jsonb, now() - interval '91 days');

select public._t('job reports one row stripped and one deleted',
  (select stripped = 1 and deleted = 1 from private.apply_model_call_retention()));

select public._t('row older than 90 days is deleted',
  not exists (select 1 from public.model_call where id = -3));
select public._t('row older than 30 days loses student, paper, image keys and free text',
  (select student_id is null and paper_id is null and image_keys = '{}' and error_detail is null
          and tool_calls = '[]'::jsonb and verification_failures = '[]'::jsonb
     from public.model_call where id = -1));
select public._t('row older than 30 days keeps run, region, tokens and stage',
  (select run_id is not null and region_id is not null and input_tokens = 100 and stage = 'explain'
     from public.model_call where id = -1));
select public._t('recent row is untouched',
  (select student_id is not null and paper_id is not null and image_keys = array['k/b.jpg']
     from public.model_call where id = -2));
select public._t('anon and authenticated cannot run the job',
  not has_function_privilege('anon', 'private.apply_model_call_retention()', 'execute')
  and not has_function_privilege('authenticated', 'private.apply_model_call_retention()', 'execute'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
