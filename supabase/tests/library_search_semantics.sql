-- ============================================================================
-- AXO-50 — Library search semantics
-- ============================================================================
-- Verifies coherent metadata/question/answer search, canonical subject filters,
-- explicit suggested/unknown states, and same-guardian sibling isolation.
-- ============================================================================

begin;

create table public._library_search_semantics_test (
  seq serial primary key,
  name text not null,
  passed boolean not null,
  detail text
);
grant all on public._library_search_semantics_test to authenticated;
grant usage, select on sequence public._library_search_semantics_test_seq_seq to authenticated;

create or replace function public._ls50_t(n text, p boolean, d text default null)
returns void
language sql
as $$ insert into public._library_search_semantics_test(name, passed, detail) values (n, p, d); $$;
grant execute on function public._ls50_t(text, boolean, text) to authenticated;

create temporary table _axo50_catalog as
select so.id as offering_id, so.programme_id, so.display_name, so.external_code
from public.subject_offering so
where so.availability='active'
order by so.id
limit 1;
grant select on table _axo50_catalog to authenticated;

do $$ begin
  if not exists (select 1 from _axo50_catalog) then
    raise exception 'AXO-50 test requires at least one seeded active subject offering';
  end if;
end $$;

insert into public.assessment_identity(
  id, programme_id, subject_offering_id, exam_year, assessment_route, title, metadata
)
select
  '50000000-0000-4000-8000-000000000001',
  programme_id,
  offering_id,
  2097,
  'axo50_verified',
  'Newton Practice',
  '{"fixture":"axo50"}'::jsonb
from _axo50_catalog;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '50111111-1111-4111-8111-111111111111',
  'authenticated','authenticated','axo50@test.invalid','x',
  now(),now(),now()
);

insert into public.guardian(
  id,auth_user_id,name,contact,verified_at,verification_method,verification_ref
) values (
  '50000000-0000-4000-8000-000000000010',
  '50111111-1111-4111-8111-111111111111',
  'AXO-50 Guardian','axo50@test.invalid',now(),'stub','axo50'
);

update public.guardian
set subscription_status='pro'::public.subscription_status,
    subscription_plan='monthly'::public.subscription_plan
where id='50000000-0000-4000-8000-000000000010';

insert into public.consent_event(
  guardian_id, student_id, purpose, granted, notice_version, method
)
select '50000000-0000-4000-8000-000000000010', null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.consent_purpose cp
where cp.is_required;

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
 ('50000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000010','Search A',11,'under_18'),
 ('50000000-0000-4000-8000-000000000012','50000000-0000-4000-8000-000000000010','Search B',11,'under_18');

-- Active student's verified, suggested and unknown papers.
insert into public.paper(
  id,student_id,type,tier,date_taken,subject,assessment_identity_id
) values (
  '50000000-0000-4000-8000-000000000020',
  '50000000-0000-4000-8000-000000000011',
  'unit_test','tier_1','2097-02-03',
  'Legacy text is not authority',
  '50000000-0000-4000-8000-000000000001'
);

insert into public.paper(id,student_id,type,tier,date_taken,subject) values
 ('50000000-0000-4000-8000-000000000021','50000000-0000-4000-8000-000000000011','mid_term','tier_1','2097-03-04',null),
 ('50000000-0000-4000-8000-000000000022','50000000-0000-4000-8000-000000000011','final_exam','tier_1','2097-04-05',null),
 ('50000000-0000-4000-8000-000000000023','50000000-0000-4000-8000-000000000012','unit_test','tier_1','2097-05-06','Sibling Secret Subject');

insert into public.extraction_run(
  id,paper_id,student_id,pipeline_version,tier_routing
) values (
  '50000000-0000-4000-8000-000000000040',
  '50000000-0000-4000-8000-000000000021',
  '50000000-0000-4000-8000-000000000011',
  'axo50',
  '{"triage":{"subject":"Tentative Mechanics","confidence":"low"}}'::jsonb
);

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,question_text,student_answer,
  marks_awarded,max_marks,marks_source,extraction_confidence
) values
 (
  '50000000-0000-4000-8000-000000000030',
  '50000000-0000-4000-8000-000000000011',
  '50000000-0000-4000-8000-000000000020',
  'tier_1','Q7b',
  'Explain axofiftyquestiontoken using Newton second law.',
  'My response contains axofiftyanswertoken and a force calculation.',
  2,3,'teacher_pen','confirmed'
 ),
 (
  '50000000-0000-4000-8000-000000000031',
  '50000000-0000-4000-8000-000000000012',
  '50000000-0000-4000-8000-000000000023',
  'tier_1','Q9',
  'Sibling question contains axofiftysiblingscrt.',
  'Sibling answer contains axofiftysiblinganswer.',
  1,2,'teacher_pen','confirmed'
 );

-- Establish Student A with a fresh signed session.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','50111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo50-search-session',
    'amr',jsonb_build_array(jsonb_build_object(
      'method','oauth',
      'timestamp',floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select public.set_student_scope('50000000-0000-4000-8000-000000000011',900);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','50111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo50-search-session'
  )::text,
  true
);

select public._ls50_t(
  'answer text finds its paper without returning raw answer text',
  (select count(*)=1 from public.search_library(
    'axofiftyanswertoken',null,'all',null,null,null,null,100
  ) where paper_id='50000000-0000-4000-8000-000000000020'
    and match_kind='question_or_answer')
);

select public._ls50_t(
  'question text finds its paper',
  (select count(*)=1 from public.search_library(
    'axofiftyquestiontoken',null,'all',null,null,null,null,100
  ) where paper_id='50000000-0000-4000-8000-000000000020')
);

select public._ls50_t(
  'exact question label receives question-label match kind',
  (select count(*)=1 from public.search_library(
    'Q7b',null,'all',null,null,null,null,100
  ) where paper_id='50000000-0000-4000-8000-000000000020'
    and match_kind='question_label')
);

select public._ls50_t(
  'assessment metadata title is searchable',
  (select count(*)=1 from public.search_library(
    'Newton Practice',null,'all',null,null,null,null,100
  ) where paper_id='50000000-0000-4000-8000-000000000020'
    and match_kind='assessment')
);

select public._ls50_t(
  'paper type metadata is searchable with display spacing',
  exists (
    select 1 from public.search_library(
      'unit test',null,'all',null,null,null,null,100
    ) where paper_id='50000000-0000-4000-8000-000000000020'
  )
);

select public._ls50_t(
  'canonical subject offering filter returns verified paper only',
  (
    select array_agg(paper_id order by paper_id)
    from public.search_library(
      null,
      (select offering_id from _axo50_catalog),
      'all',null,null,null,null,100
    )
  ) = array['50000000-0000-4000-8000-000000000020'::uuid]
);

select public._ls50_t(
  'suggested subject is explicit and remains non-canonical',
  exists (
    select 1 from public.search_library(
      null,null,'suggested',null,null,null,null,100
    )
    where paper_id='50000000-0000-4000-8000-000000000021'
      and subject_state='suggested'
      and suggested_subject='Tentative Mechanics'
      and suggested_confidence='low'
  )
);

select public._ls50_t(
  'paper progress exposes the same safe triage subject suggestion for default Library browsing',
  exists (
    select 1 from public.paper_progress
    where paper_id='50000000-0000-4000-8000-000000000021'
      and suggested_subject='Tentative Mechanics'
      and suggested_confidence='low'
  )
);

select public._ls50_t(
  'unknown subject is a first-class state',
  exists (
    select 1 from public.search_library(
      null,null,'unknown',null,null,null,null,100
    )
    where paper_id='50000000-0000-4000-8000-000000000022'
      and subject_state='unknown'
      and suggested_subject is null
  )
);

select public._ls50_t(
  'same-guardian sibling private answer cannot be searched',
  (select count(*)=0 from public.search_library(
    'axofiftysiblinganswer',null,'all',null,null,null,null,100
  ))
);

select public._ls50_t(
  'same-guardian sibling paper cannot appear in browse search',
  (select count(*)=0 from public.search_library(
    null,null,'all',null,null,null,null,250
  ) where paper_id='50000000-0000-4000-8000-000000000023')
);

reset role;

select
  count(*) as total,
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed
from public._library_search_semantics_test;

select seq, name, passed, detail
from public._library_search_semantics_test
where not passed
order by seq;

do $$
declare failures integer;
begin
  select count(*) into failures
  from public._library_search_semantics_test
  where not passed;
  if failures > 0 then
    raise exception 'AXO-50 Library search semantics failures: %', failures;
  end if;
end $$;

rollback;
