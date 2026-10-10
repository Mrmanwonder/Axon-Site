-- ============================================================================
-- Test suite: AXO-54 elevated-function authority surface
-- ============================================================================
-- Two halves.
--
-- 1. The catalog. Every SECURITY DEFINER function in public/private is checked
--    against an explicit allowlist of who may execute it. A new elevated
--    function, or a grant widened by accident, fails here until it is
--    deliberately added — which forces the ownership review AXO-53 did by hand.
--
-- 2. Abuse. Guardian B calls every browser-facing elevated RPC trying to reach
--    guardian A's account or student. Every attempt must fail or return only
--    B's own state.
--
-- Rolls back; safe against any database.
--   psql "$DATABASE_URL" -f supabase/tests/axo_54_authority_surface.sql
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- ── 1 · catalog ────────────────────────────────────────────────────────────

create temp table _definer as
select n.nspname::text as schema, p.proname::text as name, p.oid,
       has_function_privilege('anon', p.oid, 'execute') as anon_x,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_x,
       exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_x,
       p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.prosecdef and n.nspname in ('public', 'private');

select public._t('anon may execute exactly one SECURITY DEFINER function: the share-token resolver',
  (select coalesce(array_agg(schema||'.'||name order by name), '{}') from _definer where anon_x)
    = array['public.resolve_academic_share'],
  (select string_agg(schema||'.'||name, ', ') from _definer where anon_x));

select public._t('authenticated may execute exactly the audited browser-facing public RPCs (AXO-57 adds begin_guardian_verification: derives the guardian from auth.uid, fresh Parent Mode, creates no verification)',
  (select coalesce(array_agg(name order by name), '{}') from _definer where schema = 'public' and auth_x)
    = array['begin_guardian_verification','claim_guardian_verification','clear_student_scope','commit_extraction_run','delete_my_account',
            'get_cross_subject_signal','get_entitlements','parent_mode_state',
            'record_explanation_feedback',  -- #169: student from the attempt, gated by student_scope_allows
            'resolve_academic_share',
            'set_paper_subject',  -- 4 Oct 2026: student from the paper, gated by student_scope_allows; only the student's own subjects
            'set_student_scope','student_scope_state',
            'tutor_enabled'],  -- AXO-126: no arguments; reads only the caller's own flag via auth.uid()
  (select string_agg(name, ', ' order by name) from _definer where schema = 'public' and auth_x));

select public._t('no SECURITY DEFINER function keeps the default PUBLIC execute grant',
  not exists (select 1 from _definer where public_x),
  (select string_agg(schema||'.'||name, ', ') from _definer where public_x));

select public._t('no client role can execute a SECURITY DEFINER trigger function',
  not exists (select 1 from _definer d join pg_proc p on p.oid = d.oid
              where p.prorettype = 'trigger'::regtype and (d.anon_x or d.auth_x)),
  (select string_agg(d.schema||'.'||d.name, ', ') from _definer d join pg_proc p on p.oid = d.oid
    where p.prorettype = 'trigger'::regtype and (d.anon_x or d.auth_x)));

select public._t('every SECURITY DEFINER function pins search_path, with pg_temp last or an empty path',
  not exists (
    select 1 from _definer
     where not exists (
       select 1 from unnest(coalesce(proconfig, '{}')) c
        where c ~ '^search_path=' and (c ~ 'pg_temp$' or c in ('search_path=""', 'search_path='))
     )),
  (select string_agg(schema||'.'||name||'='||coalesce(array_to_string(proconfig, ','), 'unset'), '; ')
     from _definer
    where not exists (select 1 from unnest(coalesce(proconfig, '{}')) c
                      where c ~ '^search_path=' and (c ~ 'pg_temp$' or c in ('search_path=""', 'search_path=')))));

select public._t('clients cannot create objects in any schema an elevated function searches',
  not has_schema_privilege('anon', 'public', 'create')
  and not has_schema_privilege('authenticated', 'public', 'create')
  and not has_schema_privilege('anon', 'private', 'create')
  and not has_schema_privilege('authenticated', 'private', 'create'));

select public._t('service-only tables grant clients nothing (RLS is not the only wall)',
  not exists (
    select 1 from unnest(array['model_call','model_route','eval_run','eval_result','r2_deletion','stripe_event',
                               'fx_rate','model_price','scheme_document','scheme_source_policy']) t
     where to_regclass('public.'||t) is not null
       and (has_table_privilege('anon', ('public.'||t)::regclass, 'select,insert,update,delete')
        or has_table_privilege('authenticated', ('public.'||t)::regclass, 'select,insert,update,delete'))),
  (select string_agg(t, ', ') from unnest(array['model_call','model_route','eval_run','eval_result','r2_deletion','stripe_event',
                               'fx_rate','model_price','scheme_document','scheme_source_policy']) t
    where to_regclass('public.'||t) is not null
      and (has_table_privilege('anon', ('public.'||t)::regclass, 'select,insert,update,delete')
       or has_table_privilege('authenticated', ('public.'||t)::regclass, 'select,insert,update,delete'))));

select public._t('anon has no USAGE on the private schema',
  not has_schema_privilege('anon', 'private', 'usage'));

-- ── 2 · abuse: guardian B against guardian A ──────────────────────────────

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','a5400000-1111-4111-8111-111111111111','authenticated','authenticated','a54@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','b5400000-2222-4222-8222-222222222222','authenticated','authenticated','b54@test.invalid','x',now(),now(),now());

insert into public.guardian
  (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref, subscription_status, subscription_renews_at) values
 ('a5400000-0000-4000-8000-000000000001','a5400000-1111-4111-8111-111111111111','Guardian A','a54@test.invalid',now(),'stub','ref-a54','pro',now() + interval '20 days'),
 ('b5400000-0000-4000-8000-000000000001','b5400000-2222-4222-8222-222222222222','Guardian B','b54@test.invalid',now(),'stub','ref-b54','free',null);

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp
where cp.is_required and g.id in ('a5400000-0000-4000-8000-000000000001','b5400000-0000-4000-8000-000000000001');

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('a5400000-0000-4000-8000-000000000002','a5400000-0000-4000-8000-000000000001','Asha',11,'under_18'),
 ('b5400000-0000-4000-8000-000000000002','b5400000-0000-4000-8000-000000000001','Ben',11,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('a5400000-0000-4000-8000-000000000010','a5400000-0000-4000-8000-000000000002','unit_test','tier_1', current_date - 5, 'Physics'),
 ('a5400000-0000-4000-8000-000000000011','a5400000-0000-4000-8000-000000000002','unit_test','tier_1', current_date - 4, 'Chemistry');

insert into public.pattern_insight (student_id, scope, cause, subjects, paper_ids, question_count, summary_text) values
 ('a5400000-0000-4000-8000-000000000002','cross_subject','procedural_slip',array['Physics','Chemistry'],
  array['a5400000-0000-4000-8000-000000000010','a5400000-0000-4000-8000-000000000011']::uuid[],2,'x');

insert into public.student_attempt (id, student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence)
values ('a5400000-0000-4000-8000-000000000020','a5400000-0000-4000-8000-000000000002','a5400000-0000-4000-8000-000000000010','tier_1','Q1',1,2,'teacher_pen','confirmed');

do $$ begin
  if to_regclass('public.guardian_feature_flag') is not null then
    execute $q$insert into public.guardian_feature_flag (guardian_id, flag, enabled)
             values ('a5400000-0000-4000-8000-000000000001', 'tutor_enabled', true)$q$;
  end if;
end $$;

-- A real ready run is needed: a nonexistent id tests only the existence guard.
insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status)
values ('a5400000-0000-4000-8000-000000000030',
        'a5400000-0000-4000-8000-000000000010',
        'a5400000-0000-4000-8000-000000000002', '1.0.0', 'ready');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b5400000-2222-4222-8222-222222222222","role":"authenticated","session_id":"axo54-b"}';

-- SECURITY DEFINER changes current_user, but must not turn an authenticated
-- caller into a trusted maintenance session through current_setting('role').
select public._t('commit caller retains authenticated SET ROLE',
 current_setting('role', true) = 'authenticated');
do $$ begin
  perform public.commit_extraction_run('a5400000-0000-4000-8000-000000000030');
  perform public._t('B cannot commit A''s ready run', false, 'committed');
exception when others then
  perform public._t('B cannot commit A''s ready run', sqlstate = '42501', sqlstate);
end $$;

-- Missing JWT role must not activate the privileged none/postgres bypass.
set local "request.jwt.claims" = '{"sub":"b5400000-2222-4222-8222-222222222222","session_id":"axo54-b"}';
do $$ begin
  perform public.commit_extraction_run('a5400000-0000-4000-8000-000000000030');
  perform public._t('missing JWT role does not bypass commit scope', false, 'committed');
exception when others then
  perform public._t('missing JWT role does not bypass commit scope', sqlstate = '42501', sqlstate);
end $$;

-- Even the owning guardian needs the active student capability.
set local "request.jwt.claims" = '{"sub":"a5400000-1111-4111-8111-111111111111","role":"authenticated","session_id":"axo54-a-without-scope"}';
do $$ begin
  perform public.commit_extraction_run('a5400000-0000-4000-8000-000000000030');
  perform public._t('owner without active Student Mode cannot commit', false, 'committed');
exception when others then
  perform public._t('owner without active Student Mode cannot commit', sqlstate = '42501', sqlstate);
end $$;
reset role;
select public._t('rejected commits left the ready run unchanged',
 (select status = 'ready' and committed_at is null from public.extraction_run
  where id = 'a5400000-0000-4000-8000-000000000030'));
set local role anon;
do $$ begin
  perform public.commit_extraction_run('a5400000-0000-4000-8000-000000000030');
  perform public._t('anon cannot call commit_extraction_run', false, 'committed');
exception when others then
  perform public._t('anon cannot call commit_extraction_run', sqlstate = '42501', sqlstate);
end $$;
reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b5400000-2222-4222-8222-222222222222","role":"authenticated","session_id":"axo54-b"}';

select public._t('B: tutor_enabled reports B''s own flag (off), not A''s (on)',
  to_regprocedure('public.tutor_enabled()') is null or public.tutor_enabled() = false);

do $$ begin
  perform public.record_explanation_feedback('a5400000-0000-4000-8000-000000000020', false);
  perform public._t('B: record_explanation_feedback on A''s question is refused', false, 'recorded');
exception when others then
  perform public._t('B: record_explanation_feedback on A''s question is refused', sqlstate = '42501', sqlstate);
end $$;

select public._t('B: get_entitlements returns B''s free state, not A''s Pro',
  (select tier = 'free' from public.get_entitlements()));

select public._t('B: get_cross_subject_signal never returns A''s student',
  not exists (select 1 from public.get_cross_subject_signal() where student_id = 'a5400000-0000-4000-8000-000000000002'));

select public._t('B: student_scope_state reports no scope (cannot read A''s sessions)',
  (select (public.student_scope_state() ->> 'active')::boolean = false));

do $$ begin
  perform public.set_student_scope('a5400000-0000-4000-8000-000000000002', 600);
  perform public._t('B: set_student_scope on A''s student is refused', false, 'scope issued');
exception when others then
  perform public._t('B: set_student_scope on A''s student is refused', sqlstate = '42501', sqlstate);
end $$;

select public._t('B: clear_student_scope touches nothing of A''s', public.clear_student_scope() = false);

select public._t('B: parent_mode_state carries no account identifiers',
  not (public.parent_mode_state() ?| array['guardian_id','student_id','user_id','email']));

-- Fresh parent auth for B only: erasure must still reach nothing of A's.
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', 'b5400000-2222-4222-8222-222222222222', 'role', 'authenticated', 'session_id', 'axo54-b',
  'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint))
)::text, true);
select public.delete_my_account();
reset role;

select public._t('B: delete_my_account erased B and left A untouched',
  exists (select 1 from public.guardian where id = 'a5400000-0000-4000-8000-000000000001' and deleted_at is null)
  and exists (select 1 from public.student where id = 'a5400000-0000-4000-8000-000000000002' and deleted_at is null)
  and exists (select 1 from public.pattern_insight where student_id = 'a5400000-0000-4000-8000-000000000002'));

-- anon: the private helpers are dead to it on two independent counts.
set local role anon;
do $$ begin
  perform private.consent_is_granted('a5400000-0000-4000-8000-000000000001', null, 'x');
  perform public._t('anon cannot execute private consent helpers', false, 'executed');
exception when insufficient_privilege then
  perform public._t('anon cannot execute private consent helpers', true, sqlstate);
end $$;
reset role;

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
