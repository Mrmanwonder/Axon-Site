-- ============================================================================
-- AXO-51 — Library search authorization and leakage boundaries
-- ============================================================================
-- Proves active Student Mode, sibling isolation, cross-account isolation, and
-- anonymous/public RPC denial for the private Library search surface.
-- ============================================================================

begin;

create table public._library_search_privacy_test (
  seq serial primary key,
  name text not null,
  passed boolean not null,
  detail text
);
grant all on public._library_search_privacy_test to authenticated;
grant usage, select on sequence public._library_search_privacy_test_seq_seq to authenticated;

create or replace function public._ls51_t(n text, p boolean, d text default null)
returns void
language sql
as $$ insert into public._library_search_privacy_test(name, passed, detail) values (n, p, d); $$;
grant execute on function public._ls51_t(text, boolean, text) to authenticated;

select public._ls51_t(
  'anonymous and PUBLIC have no search_library execute grant',
  not exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema='public'
      and routine_name='search_library'
      and grantee in ('anon','PUBLIC')
      and privilege_type='EXECUTE'
  )
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) values
 (
  '00000000-0000-0000-0000-000000000000',
  '51111111-1111-4111-8111-111111111111',
  'authenticated','authenticated','axo51-a@test.invalid','x',now(),now(),now()
 ),
 (
  '00000000-0000-0000-0000-000000000000',
  '52222222-2222-4222-8222-222222222222',
  'authenticated','authenticated','axo51-b@test.invalid','x',now(),now(),now()
 );

insert into public.guardian(
  id,auth_user_id,name,contact,verified_at,verification_method,verification_ref
) values
 (
  '51000000-0000-4000-8000-000000000001',
  '51111111-1111-4111-8111-111111111111',
  'AXO-51 Guardian A','axo51-a@test.invalid',now(),'stub','axo51-a'
 ),
 (
  '52000000-0000-4000-8000-000000000001',
  '52222222-2222-4222-8222-222222222222',
  'AXO-51 Guardian B','axo51-b@test.invalid',now(),'stub','axo51-b'
 );

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
 (
  '51000000-0000-4000-8000-000000000011',
  '51000000-0000-4000-8000-000000000001',
  'Guardian A Active',11,'under_18'
 ),
 (
  '51000000-0000-4000-8000-000000000012',
  '51000000-0000-4000-8000-000000000001',
  'Guardian A Sibling',11,'under_18'
 ),
 (
  '52000000-0000-4000-8000-000000000011',
  '52000000-0000-4000-8000-000000000001',
  'Guardian B Student',11,'under_18'
 );

insert into public.paper(id,student_id,type,tier,date_taken,subject) values
 (
  '51000000-0000-4000-8000-000000000020',
  '51000000-0000-4000-8000-000000000011',
  'unit_test','tier_1','2097-06-01',null
 ),
 (
  '51000000-0000-4000-8000-000000000021',
  '51000000-0000-4000-8000-000000000012',
  'unit_test','tier_1','2097-06-02',null
 ),
 (
  '52000000-0000-4000-8000-000000000020',
  '52000000-0000-4000-8000-000000000011',
  'unit_test','tier_1','2097-06-03',null
 );

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,question_text,student_answer,
  marks_awarded,max_marks,marks_source,extraction_confidence
) values
 (
  '51000000-0000-4000-8000-000000000030',
  '51000000-0000-4000-8000-000000000011',
  '51000000-0000-4000-8000-000000000020',
  'tier_1','Q1',
  'Active student question axo51activequestion.',
  'Active student private answer axo51activeanswer.',
  1,2,'teacher_pen','confirmed'
 ),
 (
  '51000000-0000-4000-8000-000000000031',
  '51000000-0000-4000-8000-000000000012',
  '51000000-0000-4000-8000-000000000021',
  'tier_1','Q2',
  'Sibling private question axo51siblingquestion.',
  'Sibling private answer axo51siblinganswer.',
  1,2,'teacher_pen','confirmed'
 ),
 (
  '52000000-0000-4000-8000-000000000030',
  '52000000-0000-4000-8000-000000000011',
  '52000000-0000-4000-8000-000000000020',
  'tier_1','Q3',
  'Other guardian private question axo51otherquestion.',
  'Other guardian private answer axo51otheranswer.',
  1,2,'teacher_pen','confirmed'
 );

-- Guardian A selects child A1 with fresh Parent Mode because two profiles exist.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','51111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo51-session-a',
    'amr',jsonb_build_array(jsonb_build_object(
      'method','oauth',
      'timestamp',floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select public.set_student_scope('51000000-0000-4000-8000-000000000011',900);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','51111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo51-session-a'
  )::text,
  true
);

select public._ls51_t(
  'active student can search own private answer',
  exists (
    select 1 from public.search_library(
      'axo51activeanswer',null,'all',null,null,null,null,100
    )
    where paper_id='51000000-0000-4000-8000-000000000020'
  )
);

select public._ls51_t(
  'active student cannot search owned sibling answer',
  (select count(*)=0 from public.search_library(
    'axo51siblinganswer',null,'all',null,null,null,null,100
  ))
);

select public._ls51_t(
  'guardian A cannot search guardian B answer',
  (select count(*)=0 from public.search_library(
    'axo51otheranswer',null,'all',null,null,null,null,100
  ))
);

select public._ls51_t(
  'browse cannot leak owned sibling or other-account papers',
  (
    select count(*)=0
    from public.search_library(null,null,'all',null,null,null,null,250)
    where paper_id in (
      '51000000-0000-4000-8000-000000000021',
      '52000000-0000-4000-8000-000000000020'
    )
  )
);

-- Guardian B gets its independent signed session and still cannot see A.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','52222222-2222-4222-8222-222222222222',
    'role','authenticated',
    'session_id','axo51-session-b',
    'amr',jsonb_build_array(jsonb_build_object(
      'method','oauth',
      'timestamp',floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select public.set_student_scope('52000000-0000-4000-8000-000000000011',900);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','52222222-2222-4222-8222-222222222222',
    'role','authenticated',
    'session_id','axo51-session-b'
  )::text,
  true
);

select public._ls51_t(
  'guardian B can search own private answer',
  exists (
    select 1 from public.search_library(
      'axo51otheranswer',null,'all',null,null,null,null,100
    )
    where paper_id='52000000-0000-4000-8000-000000000020'
  )
);

select public._ls51_t(
  'guardian B cannot search guardian A answer',
  (select count(*)=0 from public.search_library(
    'axo51activeanswer',null,'all',null,null,null,null,100
  ))
);

reset role;

select
  count(*) as total,
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed
from public._library_search_privacy_test;

select seq, name, passed, detail
from public._library_search_privacy_test
where not passed
order by seq;

do $$
declare failures integer;
begin
  select count(*) into failures
  from public._library_search_privacy_test
  where not passed;
  if failures > 0 then
    raise exception 'AXO-51 Library search privacy failures: %', failures;
  end if;
end $$;

rollback;
