-- ============================================================================
-- AXO-49 — verified subject identity + private Library search foundation
-- ============================================================================
-- Proves that canonical subject state is server-authored, free-text subject
-- guesses never become verification, and attempt search remains bound to the
-- active Student Mode through normal student_attempt RLS.
-- ============================================================================

begin;

create table public._library_search_foundation_test (
  seq serial primary key,
  name text not null,
  passed boolean not null,
  detail text
);
grant all on public._library_search_foundation_test to authenticated;
grant usage, select on sequence public._library_search_foundation_test_seq_seq to authenticated;

create or replace function public._lsf_t(n text, p boolean, d text default null)
returns void
language sql
as $$ insert into public._library_search_foundation_test(name, passed, detail) values (n, p, d); $$;
grant execute on function public._lsf_t(text, boolean, text) to authenticated;

-- One real catalog offering is enough: the test verifies that paper identity
-- snapshots exactly that stored catalog row rather than a caller-authored name.
create temporary table _axo49_catalog as
select so.id as offering_id, so.programme_id, so.display_name, so.external_code
from public.subject_offering so
where so.availability='active'
order by so.id
limit 1;

do $$ begin
  if not exists (select 1 from _axo49_catalog) then
    raise exception 'AXO-49 test requires at least one seeded active subject offering';
  end if;
end $$;

insert into public.assessment_identity(
  id, programme_id, subject_offering_id, exam_year, assessment_route, title, metadata
)
select
  '49000000-0000-4000-8000-000000000001',
  programme_id,
  offering_id,
  2098,
  'axo49_verified',
  'AXO-49 verified search fixture',
  '{"fixture":"axo49"}'::jsonb
from _axo49_catalog;

insert into public.assessment_identity(
  id, programme_id, subject_offering_id, exam_year, assessment_route, title, metadata
)
select
  '49000000-0000-4000-8000-000000000002',
  programme_id,
  null,
  2098,
  'axo49_unresolved',
  'AXO-49 unresolved search fixture',
  '{"fixture":"axo49-unresolved"}'::jsonb
from _axo49_catalog;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '49111111-1111-4111-8111-111111111111',
  'authenticated','authenticated','axo49@test.invalid','x',
  now(),now(),now()
);

insert into public.guardian(
  id,auth_user_id,name,contact,verified_at,verification_method,verification_ref
) values (
  '49000000-0000-4000-8000-000000000010',
  '49111111-1111-4111-8111-111111111111',
  'AXO-49 Guardian','axo49@test.invalid',now(),'stub','axo49'
);

update public.guardian
set subscription_status='pro'::public.subscription_status,
    subscription_plan='monthly'::public.subscription_plan
where id='49000000-0000-4000-8000-000000000010';

insert into public.consent_event(
  guardian_id, student_id, purpose, granted, notice_version, method
)
select '49000000-0000-4000-8000-000000000010', null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.consent_purpose cp
where cp.is_required;

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
 ('49000000-0000-4000-8000-000000000011','49000000-0000-4000-8000-000000000010','Search A',11,'under_18'),
 ('49000000-0000-4000-8000-000000000012','49000000-0000-4000-8000-000000000010','Search B',11,'under_18');

-- Privileged pipeline-style identity binding: canonical subject fields must be
-- filled from the assessment identity/catalog, not from the legacy subject text.
insert into public.paper(
  id,student_id,type,tier,date_taken,subject,assessment_identity_id
) values (
  '49000000-0000-4000-8000-000000000020',
  '49000000-0000-4000-8000-000000000011',
  'unit_test','tier_1',current_date,
  'A caller could write any legacy string here',
  '49000000-0000-4000-8000-000000000001'
);

insert into public.paper(
  id,student_id,type,tier,date_taken,subject,assessment_identity_id
) values (
  '49000000-0000-4000-8000-000000000021',
  '49000000-0000-4000-8000-000000000011',
  'unit_test','tier_1',current_date,
  'This must not become verified',
  '49000000-0000-4000-8000-000000000002'
);

insert into public.paper(
  id,student_id,type,tier,date_taken,subject
) values (
  '49000000-0000-4000-8000-000000000022',
  '49000000-0000-4000-8000-000000000012',
  'unit_test','tier_1',current_date,
  'Sibling legacy subject'
);

select public._lsf_t(
  'exact assessment identity snapshots canonical subject offering',
  exists (
    select 1
    from public.paper p
    cross join _axo49_catalog c
    where p.id='49000000-0000-4000-8000-000000000020'
      and p.subject_offering_id=c.offering_id
      and p.subject_display_snapshot=c.display_name
      and p.subject_external_code_snapshot is not distinct from c.external_code
      and p.subject_identity_source='assessment_identity'
      and p.subject_identity_confidence='verified'
      and p.subject_verified_at is not null
  )
);

select public._lsf_t(
  'subject-unresolved assessment stays explicitly unknown',
  exists (
    select 1 from public.paper
    where id='49000000-0000-4000-8000-000000000021'
      and subject_offering_id is null
      and subject_display_snapshot is null
      and subject_identity_source is null
      and subject_identity_confidence is null
      and subject_verified_at is null
  )
);


-- The snapshot is historical evidence. Later catalog copy edits must not rewrite
-- what this paper was verified as at binding time.
update public.subject_offering so
   set display_name = so.display_name || ' — catalog drift fixture'
  from _axo49_catalog c
 where so.id=c.offering_id;

select public._lsf_t(
  'verified subject snapshot survives later catalog drift',
  exists (
    select 1
    from public.paper p
    cross join _axo49_catalog c
    where p.id='49000000-0000-4000-8000-000000000020'
      and p.subject_display_snapshot=c.display_name
  )
);

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,question_text,student_answer,
  marks_awarded,max_marks,marks_source,extraction_confidence
) values
 (
  '49000000-0000-4000-8000-000000000030',
  '49000000-0000-4000-8000-000000000011',
  '49000000-0000-4000-8000-000000000020',
  'tier_1','Q1',
  'Explain axonfortyninequestiontoken in one sentence.',
  'The answer contains axonfortynineanswertoken for private search.',
  2,2,'teacher_pen','confirmed'
 ),
 (
  '49000000-0000-4000-8000-000000000031',
  '49000000-0000-4000-8000-000000000012',
  '49000000-0000-4000-8000-000000000022',
  'tier_1','Q2',
  'Explain siblingquestionsecret in one sentence.',
  'The sibling answer contains siblinganswersecret.',
  2,2,'teacher_pen','confirmed'
 );

select public._lsf_t(
  'attempt search representation indexes question and answer text',
  exists (
    select 1 from public.student_attempt
    where id='49000000-0000-4000-8000-000000000030'
      and search_vector @@ pg_catalog.websearch_to_tsquery('simple'::regconfig,'axonfortyninequestiontoken')
      and search_vector @@ pg_catalog.websearch_to_tsquery('simple'::regconfig,'axonfortynineanswertoken')
  )
);

-- Establish Student A under a real signed-session Student Mode.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','49111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo49-search-session',
    'amr',jsonb_build_array(jsonb_build_object(
      'method','oauth',
      'timestamp',floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select public.set_student_scope('49000000-0000-4000-8000-000000000011',900);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','49111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo49-search-session'
  )::text,
  true
);

select public._lsf_t(
  'search RPC finds active-student answer term',
  (select count(*)=1
     from public.search_library_attempts('axonfortynineanswertoken',50)
    where paper_id='49000000-0000-4000-8000-000000000020')
);

select public._lsf_t(
  'search RPC cannot reveal owned sibling answer term',
  (select count(*)=0
     from public.search_library_attempts('siblinganswersecret',50))
);

select public._lsf_t(
  'direct attempt search cannot reveal sibling lexemes',
  (select count(*)=0
     from public.student_attempt
    where search_vector @@ pg_catalog.websearch_to_tsquery('simple'::regconfig,'siblinganswersecret'))
);

do $$ begin
  begin
    update public.paper
       set assessment_identity_id='49000000-0000-4000-8000-000000000002'
     where id='49000000-0000-4000-8000-000000000020';
    perform public._lsf_t('Student Mode cannot forge assessment identity',false,'update succeeded');
  exception when sqlstate '42501' then
    perform public._lsf_t('Student Mode cannot forge assessment identity',true,sqlerrm);
  end;
end $$;

-- Snapshot columns are not caller-writable either. Reject rather than
-- refreshing from the now-drifted catalog, preserving historical stability.
do $$ begin
  begin
    update public.paper
       set subject_display_snapshot='Forged subject'
     where id='49000000-0000-4000-8000-000000000020';
    perform public._lsf_t('Student Mode cannot forge canonical subject snapshot',false,'update succeeded');
  exception when sqlstate '42501' then
    perform public._lsf_t('Student Mode cannot forge canonical subject snapshot',true,sqlerrm);
  end;
end $$;

select public._lsf_t(
  'rejected snapshot forgery leaves historical value unchanged',
  exists (
    select 1
    from public.paper p
    cross join _axo49_catalog c
    where p.id='49000000-0000-4000-8000-000000000020'
      and p.subject_display_snapshot=c.display_name
  )
);

reset role;

select public._lsf_t(
  'attempt full-text GIN index exists',
  exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='student_attempt'
      and indexname='student_attempt_search_vector_gin'
      and indexdef ilike '%using gin%'
  )
);

select public._lsf_t(
  'verified paper subject index exists',
  exists (
    select 1 from pg_indexes
    where schemaname='public'
      and tablename='paper'
      and indexname='paper_student_verified_subject_idx'
  )
);

select public._lsf_t(
  'Library search RPC is security invoker',
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='search_library_attempts'
      and p.prosecdef=false
  )
);

select public._lsf_t(
  'anon has no Library search RPC execute grant',
  not exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema='public'
      and routine_name='search_library_attempts'
      and grantee in ('anon','PUBLIC')
      and privilege_type='EXECUTE'
  )
);

select public._lsf_t(
  'authenticated has Library search RPC execute grant',
  exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema='public'
      and routine_name='search_library_attempts'
      and grantee='authenticated'
      and privilege_type='EXECUTE'
  )
);

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._library_search_foundation_test;

select seq,name,passed,detail
from public._library_search_foundation_test
where not passed
order by seq;

do $$
begin
  if exists (select 1 from public._library_search_foundation_test where not passed) then
    raise exception 'AXO-49 library search foundation tests failed';
  end if;
end $$;

rollback;
