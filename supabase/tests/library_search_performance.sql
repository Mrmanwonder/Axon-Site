-- ============================================================================
-- AXO-52 — realistic private Library search performance
-- ============================================================================
-- Seeds an isolated, rollback-only Student Mode library large enough to catch
-- accidental full-scan regressions. It benchmarks the real search_library RPC
-- with rare/common text and canonical-subject filtering, and proves the private
-- attempt-text predicate can use the production GIN index.
-- ============================================================================

begin;

create temporary table _axo52_catalog as
select so.id as offering_id, so.programme_id
from public.subject_offering so
where so.availability='active'
order by so.id
limit 1;

do $$ begin
  if not exists (select 1 from _axo52_catalog) then
    raise exception 'AXO-52 benchmark requires one seeded active subject offering';
  end if;
end $$;

insert into public.assessment_identity(
  id, programme_id, subject_offering_id, exam_year, assessment_route, title, metadata
)
select
  '52000000-0000-4000-8000-000000000001',
  programme_id,
  offering_id,
  2098,
  'axo52_benchmark',
  'AXO-52 benchmark assessment',
  '{"fixture":"axo52"}'::jsonb
from _axo52_catalog;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '52111111-1111-4111-8111-111111111111',
  'authenticated','authenticated','axo52@test.invalid','x',
  now(),now(),now()
);

insert into public.guardian(
  id,auth_user_id,name,contact,verified_at,verification_method,verification_ref
) values (
  '52000000-0000-4000-8000-000000000010',
  '52111111-1111-4111-8111-111111111111',
  'AXO-52 Guardian','axo52@test.invalid',now(),'stub','axo52'
);

update public.guardian
set subscription_status='pro'::public.subscription_status,
    subscription_plan='monthly'::public.subscription_plan
where id='52000000-0000-4000-8000-000000000010';

insert into public.consent_event(
  guardian_id, student_id, purpose, granted, notice_version, method
)
select '52000000-0000-4000-8000-000000000010', null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.consent_purpose cp
where cp.is_required;

insert into public.student(id,guardian_id,first_name,class_level,age_band)
values (
  '52000000-0000-4000-8000-000000000011',
  '52000000-0000-4000-8000-000000000010',
  'Benchmark Student',11,'under_18'
);

create temporary table _axo52_paper_map(
  n integer primary key,
  id uuid not null default gen_random_uuid()
);

insert into _axo52_paper_map(n)
select generate_series(1,300);

insert into public.paper(
  id,student_id,type,tier,date_taken,assessment_identity_id
)
select
  m.id,
  '52000000-0000-4000-8000-000000000011',
  (case m.n % 3
    when 0 then 'unit_test'
    when 1 then 'mid_term'
    else 'final_exam'
  end)::public.paper_type,
  (case when m.n % 5 = 0 then 'tier_2' else 'tier_1' end)::public.paper_tier,
  date '2098-01-01' + (m.n % 180),
  case when m.n % 2 = 0
    then '52000000-0000-4000-8000-000000000001'::uuid
    else null
  end
from _axo52_paper_map m;

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,question_text,student_answer,
  marks_awarded,max_marks,marks_source,extraction_confidence
)
select
  gen_random_uuid(),
  '52000000-0000-4000-8000-000000000011',
  m.id,
  (case when m.n % 5 = 0 then 'tier_2' else 'tier_1' end)::public.paper_tier,
  'Q' || q.n,
  case
    when m.n = 257 and q.n = 7
      then 'Derive the axo52raretoken result from first principles.'
    when m.n % 3 = 0
      then 'Explain commonforce using the relevant physical principle.'
    else 'Explain ordinary benchmark concept ' || m.n || ' part ' || q.n || '.'
  end,
  case
    when m.n = 257 and q.n = 7
      then 'My answer contains axo52raretoken and a unique derivation.'
    when m.n % 3 = 0
      then 'My answer discusses commonforce with working and units.'
    else 'Ordinary benchmark response ' || m.n || ' ' || q.n || '.'
  end,
  1,2,'teacher_pen','confirmed'
from _axo52_paper_map m
cross join generate_series(1,12) q(n);

analyze public.paper;
analyze public.student_attempt;

create temporary table _axo52_timings(
  kind text not null,
  elapsed_ms double precision not null
);
grant select, insert on _axo52_timings to authenticated;

create temporary table _axo52_plan(line text);
grant select, insert on _axo52_plan to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','52111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo52-benchmark-session',
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
    'sub','52111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo52-benchmark-session'
  )::text,
  true
);

-- Correctness on the benchmark fixture.
do $$
declare
  v_offering uuid := (select offering_id from _axo52_catalog);
  v_rare integer;
  v_common integer;
  v_subject integer;
begin
  select count(*) into v_rare
  from public.search_library('axo52raretoken',null,'all',null,null,null,null,250);
  if v_rare <> 1 then
    raise exception 'AXO-52 rare search expected 1 row, got %', v_rare;
  end if;

  select count(*) into v_common
  from public.search_library('commonforce',null,'all',null,null,null,null,250);
  if v_common <> 100 then
    raise exception 'AXO-52 common search expected 100 papers, got %', v_common;
  end if;

  select count(*) into v_subject
  from public.search_library(null,v_offering,'all',null,null,null,null,250);
  if v_subject <> 150 then
    raise exception 'AXO-52 canonical subject filter expected 150 papers, got %', v_subject;
  end if;
end $$;

-- Warm the relevant paths before sampling.
select count(*) from public.search_library('axo52raretoken',null,'all',null,null,null,null,250);
select count(*) from public.search_library('commonforce',null,'all',null,null,null,null,null,250);
select count(*) from public.search_library(
  null,(select offering_id from _axo52_catalog),'all',null,null,null,null,250
);

do $$
declare
  i integer;
  started timestamptz;
  elapsed double precision;
  offering uuid := (select offering_id from _axo52_catalog);
begin
  for i in 1..20 loop
    started := clock_timestamp();
    perform count(*) from public.search_library(
      'axo52raretoken',null,'all',null,null,null,null,250
    );
    elapsed := extract(epoch from (clock_timestamp() - started)) * 1000;
    insert into _axo52_timings values ('rare_text', elapsed);

    started := clock_timestamp();
    perform count(*) from public.search_library(
      'commonforce',null,'all',null,null,null,null,null,250
    );
    elapsed := extract(epoch from (clock_timestamp() - started)) * 1000;
    insert into _axo52_timings values ('common_text', elapsed);

    started := clock_timestamp();
    perform count(*) from public.search_library(
      null,offering,'all','unit_test','tier_1','2098-01-01','2098-06-30',250
    );
    elapsed := extract(epoch from (clock_timestamp() - started)) * 1000;
    insert into _axo52_timings values ('filtered_browse', elapsed);
  end loop;
end $$;

-- EXPLAIN the exact FTS predicate search_library uses. Rare-term lookup should
-- naturally select the production GIN index at this fixture size.
do $$
declare
  plan_line text;
  plan_text text := '';
begin
  for plan_line in execute $plan$
    explain (costs off)
    select a.paper_id
    from public.student_attempt a
    where a.search_vector @@ pg_catalog.websearch_to_tsquery(
      'simple'::regconfig, 'axo52raretoken'
    )
  $plan$
  loop
    plan_text := plan_text || E'\n' || plan_line;
    insert into _axo52_plan values (plan_line);
  end loop;

  if position('student_attempt_search_vector_gin' in plan_text) = 0 then
    raise exception 'AXO-52 expected GIN search plan, got:%', plan_text;
  end if;
end $$;

reset role;

-- CI budget is intentionally generous enough for shared runners while still
-- catching a severe regression. Product acceptance records the measured values,
-- not just pass/fail.
do $$
declare
  rare_p95 double precision;
  common_p95 double precision;
  filtered_p95 double precision;
begin
  select percentile_cont(0.95) within group (order by elapsed_ms)
    into rare_p95 from _axo52_timings where kind='rare_text';
  select percentile_cont(0.95) within group (order by elapsed_ms)
    into common_p95 from _axo52_timings where kind='common_text';
  select percentile_cont(0.95) within group (order by elapsed_ms)
    into filtered_p95 from _axo52_timings where kind='filtered_browse';

  if rare_p95 >= 500 then
    raise exception 'AXO-52 rare-text p95 %.2fms exceeds 500ms CI budget', rare_p95;
  end if;
  if common_p95 >= 750 then
    raise exception 'AXO-52 common-text p95 %.2fms exceeds 750ms CI budget', common_p95;
  end if;
  if filtered_p95 >= 500 then
    raise exception 'AXO-52 filtered-browse p95 %.2fms exceeds 500ms CI budget', filtered_p95;
  end if;
end $$;

select
  kind,
  round(percentile_cont(0.50) within group (order by elapsed_ms)::numeric, 2) as p50_ms,
  round(percentile_cont(0.95) within group (order by elapsed_ms)::numeric, 2) as p95_ms,
  round(max(elapsed_ms)::numeric, 2) as max_ms,
  count(*) as samples
from _axo52_timings
group by kind
order by kind;

select line
from _axo52_plan
where line ilike '%student_attempt_search_vector_gin%';

rollback;
