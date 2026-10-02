-- ============================================================================
-- Test suite: AXO-128 telemetry is anonymised when a paper or student is deleted
-- ============================================================================
-- model_call and eval_result have no foreign keys to paper or student, so
-- deleting either used to leave ids, region ids and R2 keys behind. They are now
-- nulled; the operational columns (stage, model, tokens, cost) survive.
--
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_124_model_cost.sql
--   Pass: the counts line reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','ga@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics');

insert into public.extraction_run (id, paper_id, student_id, pipeline_version, reconciled)
values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
        'aaaaaaaa-0000-4000-8000-000000000002','1.0.0', true);


-- eval_result needs a parent run
insert into public.eval_run (id, golden_set_version) values ('aaaaaaaa-0000-4000-8000-0000000000e1', 't')
on conflict do nothing;

insert into public.model_call (run_id, paper_id, student_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens, image_keys, error_detail, tool_calls, verification_failures)
values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',
        'explain','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', true, 1000, 200,
        array['students/a/papers/p/page-1.jpg'], 'quoted printed question text',
        '[{"q":"printed question text"}]'::jsonb, '[{"quote":"student answer"}]'::jsonb);

insert into public.model_call (student_id, stage, requested_model, model_id, prompt_version, ok, input_tokens, billed_output_tokens)
values ('aaaaaaaa-0000-4000-8000-000000000002','tutor','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', true, 500, 100);

insert into public.eval_result (eval_run_id, paper_id, golden_id, status)
values ('aaaaaaaa-0000-4000-8000-0000000000e1','aaaaaaaa-0000-4000-8000-000000000003','g1','done');

select public._t('before deletion the rows carry identifiers',
  (select count(*) = 2 from public.model_call where student_id = 'aaaaaaaa-0000-4000-8000-000000000002'));

-- ── deleting the paper anonymises the paper's calls and eval results ────────

delete from public.paper where id = 'aaaaaaaa-0000-4000-8000-000000000003';

select public._t('paper delete: model_call loses student, paper, run and image keys',
  (select count(*) = 1 from public.model_call
    where stage = 'explain' and paper_id is null and student_id is null and run_id is null
      and image_keys = '{}' and error_detail is null
      and tool_calls = '[]'::jsonb and verification_failures = '[]'::jsonb));

select public._t('paper delete: the operational facts survive',
  (select input_tokens = 1000 and billed_output_tokens = 200 and cost_usd is not null and model_id = 'gemini-3.1-flash-lite'
     from public.model_call where stage = 'explain'));

select public._t('paper delete: eval_result loses the paper',
  (select paper_id is null from public.eval_result where golden_id = 'g1'));

select public._t('paper delete: the paperless tutor call is untouched until the student goes',
  (select student_id is not null from public.model_call where stage = 'tutor'));

-- ── deleting the student anonymises its paperless calls ─────────────────────

delete from public.student where id = 'aaaaaaaa-0000-4000-8000-000000000002';

select public._t('student delete: no model_call row names the student any more',
  (select count(*) = 0 from public.model_call where student_id = 'aaaaaaaa-0000-4000-8000-000000000002'));

select public._t('student delete: the tutor call is kept, anonymised',
  (select count(*) = 1 from public.model_call where stage = 'tutor' and student_id is null));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
