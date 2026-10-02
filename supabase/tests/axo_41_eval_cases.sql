-- Test suite: AXO-41 eval cases and results. Rolls back.
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_41_eval_cases.sql
begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

select public._t('the synthetic explain set is seeded: 24 cases, 8 per curriculum',
  (select count(*) = 24 and count(*) filter (where curriculum='cambridge') = 8
      and count(*) filter (where curriculum='cbse') = 8 and count(*) filter (where curriculum='ibdp') = 8
     from public.eval_case where golden_set_version = 'explain-synthetic-v1'));

select public._t('every seeded case is a draft: none is release-gate truth until a person labels it',
  (select bool_and(needs_human_label and human_labels is null and draft_labels is not null)
     from public.eval_case where golden_set_version = 'explain-synthetic-v1'));

select public._t('clients have no access to cases or results',
  not has_table_privilege('authenticated', 'public.eval_case', 'select')
  and not has_table_privilege('anon', 'public.eval_case_result', 'select')
  and has_table_privilege('service_role', 'public.eval_case_result', 'insert'));

do $$
begin
  begin
    insert into public.eval_case (id, golden_set_version, stage, source, curriculum)
    values ('eeeeeeee-0000-4000-8000-000000000001', 't', 'explain', 'synthetic', 'cbse');
    perform public._t('a synthetic case with no input is refused', false);
  exception when check_violation then
    perform public._t('a synthetic case with no input is refused', true);
  end;
  begin
    insert into public.eval_case (id, golden_set_version, stage, source, curriculum, input)
    values ('eeeeeeee-0000-4000-8000-000000000002', 't', 'explain', 'production', 'cbse', '{}');
    perform public._t('a production case must point at a stored region, not carry text', false);
  exception when check_violation then
    perform public._t('a production case must point at a stored region, not carry text', true);
  end;
  begin
    insert into public.eval_case (id, golden_set_version, stage, source, curriculum, input, needs_human_label, human_labels)
    values ('eeeeeeee-0000-4000-8000-000000000003', 't', 'explain', 'synthetic', 'cbse', '{}', false, '{"cause":"incomplete"}');
    perform public._t('a case cannot be marked human-labelled without who and when', false);
  exception when check_violation then
    perform public._t('a case cannot be marked human-labelled without who and when', true);
  end;
end $$;

-- a production case dies with its region
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
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics');
insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status) values
 ('aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready');
insert into public.question_region (id, run_id, paper_id, student_id, order_index, question_label, question_label_box,
    marks_awarded, marks_awarded_box, marks_available, marks_available_box, confidence_tier, needs_review, student_confirmed_at)
values ('aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1',
    'aaaaaaaa-0000-4000-8000-000000000002', 0, 'Q1', '{"page":1,"x":3,"y":3,"w":1,"h":1}',
    1, '{"page":1,"x":1,"y":1,"w":1,"h":1}', 3, '{"page":1,"x":2,"y":2,"w":1,"h":1}', 'confident', false, now());

insert into public.eval_case (id, golden_set_version, stage, source, curriculum, source_region_id)
values ('eeeeeeee-0000-4000-8000-000000000004', 't', 'explain', 'production', 'cambridge', 'aaaaaaaa-0000-4000-8000-0000000000c1');
delete from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c1';
select public._t('deleting the stored region deletes the production case that pointed at it',
  not exists (select 1 from public.eval_case where id = 'eeeeeeee-0000-4000-8000-000000000004'));

-- results: one per case and candidate, scores bounded
insert into public.eval_run (id, golden_set_version, stages, kind) values
 ('eeeeeeee-0000-4000-8000-0000000000f1', 't', '{explain}', 'stage');
insert into public.eval_case_result (eval_run_id, case_id, candidate_key, model)
select 'eeeeeeee-0000-4000-8000-0000000000f1', id, 'a', 'gemini-3.8-flash'
  from public.eval_case where golden_set_version = 'explain-synthetic-v1' limit 1;
do $$
begin
  begin
    insert into public.eval_case_result (eval_run_id, case_id, candidate_key, model)
    select 'eeeeeeee-0000-4000-8000-0000000000f1', id, 'a', 'gemini-3.8-flash'
      from public.eval_case where golden_set_version = 'explain-synthetic-v1' limit 1;
    perform public._t('a candidate answers a case once per run', false);
  exception when unique_violation then
    perform public._t('a candidate answers a case once per run', true);
  end;
  begin
    insert into public.eval_case_result (eval_run_id, case_id, candidate_key, model, faithfulness)
    select 'eeeeeeee-0000-4000-8000-0000000000f1', id, 'b', 'gemini-3.6-flash', 9
      from public.eval_case where golden_set_version = 'explain-synthetic-v1' limit 1;
    perform public._t('a faithfulness score outside 1-5 is refused', false);
  exception when check_violation then
    perform public._t('a faithfulness score outside 1-5 is refused', true);
  end;
end $$;

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;
rollback;
