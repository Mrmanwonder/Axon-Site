-- ============================================================================
-- AXO-52 — production-like Library search performance and synchronous indexing
-- ============================================================================
-- 500 active-student papers / 5,000 attempts plus 100 sibling papers / 1,000
-- attempts. The suite measures warm p50/p95 for common, rare and filtered
-- private search calls under real signed Student Mode/RLS, captures EXPLAIN
-- plans for the FTS and canonical-subject indexes, and proves the generated
-- tsvector is searchable immediately after an answer update.
--
-- Warm local/staging acceptance budget: every measured search family p95
-- <= 250 ms. The client adds a 180 ms debounce, keeping the normal p95
-- interaction budget below roughly 0.5 s without relying on stale results.
-- ============================================================================

begin;

create table public._library_search_benchmark_test (
  seq serial primary key,
  name text not null,
  passed boolean not null,
  detail text
);
grant all on public._library_search_benchmark_test to authenticated;
grant usage, select on sequence public._library_search_benchmark_test_seq_seq to authenticated;

create or replace function public._ls52_t(n text, p boolean, d text default null)
returns void
language sql
as $$ insert into public._library_search_benchmark_test(name, passed, detail) values (n, p, d); $$;
grant execute on function public._ls52_t(text, boolean, text) to authenticated;

create table public._library_search_benchmark_timing (
  label text not null,
  run_no integer not null,
  elapsed_ms double precision not null
);
grant insert, select on public._library_search_benchmark_timing to authenticated;

create temporary table _axo52_catalog as
select so.id as offering_id, so.programme_id, so.display_name, so.external_code
from public.subject_offering so
where so.availability='active'
order by so.id
limit 1;
grant select on table _axo52_catalog to authenticated;

do $$
begin
  if not exists (select 1 from _axo52_catalog) then
    raise exception 'AXO-52 benchmark requires at least one seeded active subject offering';
  end if;
end $$;

insert into public.assessment_identity(
  id, programme_id, subject_offering_id, exam_year, assessment_route, title, metadata
)
select
  '52000000-0000-4000-8000-000000000001',
  programme_id,
  offering_id,
  2097,
  'axo52_verified',
  'AXO-52 production-like benchmark',
  '{"fixture":"axo52","papers":500,"attempts":5000}'::jsonb
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

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
 ('52000000-0000-4000-8000-000000000011','52000000-0000-4000-8000-000000000010','Benchmark Active',11,'under_18'),
 ('52000000-0000-4000-8000-000000000012','52000000-0000-4000-8000-000000000010','Benchmark Sibling',11,'under_18');

-- 500 active papers. Ten percent carry an exact canonical assessment identity
-- so the canonical-subject index remains realistically selective; the remainder
-- retain only a visible legacy subject suggestion.
insert into public.paper(
  id,student_id,type,tier,date_taken,subject,assessment_identity_id
)
select
  ('52000000-0000-4000-8000-' || lpad(gs::text,12,'0'))::uuid,
  '52000000-0000-4000-8000-000000000011'::uuid,
  case when gs % 3 = 0 then 'mid_term' else 'unit_test' end,
  'tier_1',
  date '2097-01-01' + ((gs - 1) % 365),
  case when gs > 50 then 'Suggested Mechanics' else 'Legacy text is not authority' end,
  case when gs <= 50 then '52000000-0000-4000-8000-000000000001'::uuid else null end
from generate_series(1,500) gs;

-- 100 sibling papers deliberately contain the same common vocabulary. Active
-- Student Mode must make them irrelevant to both timing results and identity set.
insert into public.paper(id,student_id,type,tier,date_taken,subject)
select
  ('53000000-0000-4000-8000-' || lpad(gs::text,12,'0'))::uuid,
  '52000000-0000-4000-8000-000000000012'::uuid,
  'unit_test','tier_1',
  date '2097-01-01' + ((gs - 1) % 100),
  'Sibling Mechanics'
from generate_series(1,100) gs;

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,question_text,student_answer,
  marks_awarded,max_marks,marks_source,extraction_confidence
)
select
  ('52100000-0000-4000-8000-' || lpad(gs::text,12,'0'))::uuid,
  '52000000-0000-4000-8000-000000000011'::uuid,
  ('52000000-0000-4000-8000-' || lpad((((gs - 1) / 10) + 1)::text,12,'0'))::uuid,
  'tier_1',
  'Q' || (((gs - 1) % 10) + 1),
  case
    when gs = 4999 then 'A uniquely rare benchmark prompt axo52raretoken.'
    when gs % 17 = 0 then 'Explain E=mc² and alpha/beta energy transfer with units.'
    else 'Explain force, motion and energy transfer in a marked response.'
  end,
  case
    when gs = 4999 then 'The unique answer contains axo52rareanswer and correct reasoning.'
    when gs % 17 = 0 then repeat('E=mc²; alpha/beta symbols survive extraction. ',8)
    when gs % 5 = 0 then repeat('Force causes acceleration and transfers energy through work. ',8)
    else repeat('A realistic written answer discusses motion, evidence and calculation. ',6)
  end,
  1,2,'teacher_pen','confirmed'
from generate_series(1,5000) gs;

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,question_text,student_answer,
  marks_awarded,max_marks,marks_source,extraction_confidence
)
select
  ('53100000-0000-4000-8000-' || lpad(gs::text,12,'0'))::uuid,
  '52000000-0000-4000-8000-000000000012'::uuid,
  ('53000000-0000-4000-8000-' || lpad((((gs - 1) / 10) + 1)::text,12,'0'))::uuid,
  'tier_1',
  'Q' || (((gs - 1) % 10) + 1),
  'Sibling-only force benchmark question axo52siblingtoken.',
  repeat('Sibling private force answer that must never affect active results. ',6),
  1,2,'teacher_pen','confirmed'
from generate_series(1,1000) gs;

analyze public.paper;
analyze public.student_attempt;

select public._ls52_t(
  'fixture contains 500 active papers',
  (select count(*)=500 from public.paper where student_id='52000000-0000-4000-8000-000000000011')
);
select public._ls52_t(
  'fixture contains 5000 active attempts',
  (select count(*)=5000 from public.student_attempt where student_id='52000000-0000-4000-8000-000000000011')
);

-- Establish the active profile with fresh Parent Mode because two profiles exist.
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
select public.set_student_scope('52000000-0000-4000-8000-000000000011',1800);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','52111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','axo52-benchmark-session'
  )::text,
  true
);

select public._ls52_t(
  'rare answer query finds exactly the active paper',
  (select count(*)=1 from public.search_library(
    'axo52rareanswer',null,'all',null,null,null,null,250
  ))
);
select public._ls52_t(
  'common answer query returns active results',
  (select count(*)>0 from public.search_library(
    'force',null,'all',null,null,null,null,250
  ))
);
select public._ls52_t(
  'same common query cannot surface sibling paper ids',
  not exists (
    select 1 from public.search_library('force',null,'all',null,null,null,null,250)
    where paper_id::text like '53000000-%'
  )
);
select public._ls52_t(
  'special-symbol fixture remains searchable by normalized terms',
  (select count(*)>0 from public.search_library(
    'alpha beta',null,'all',null,null,null,null,250
  ))
);

do $$
declare
  i integer;
  started timestamptz;
  offering uuid;
begin
  select offering_id into offering from _axo52_catalog;

  -- Three warmups per family so p50/p95 reflects steady-state query work.
  for i in 1..3 loop
    perform count(*) from public.search_library('force',null,'all',null,null,null,null,250);
    perform count(*) from public.search_library('axo52rareanswer',null,'all',null,null,null,null,250);
    perform count(*) from public.search_library('force',offering,'all',null,null,null,null,250);
    perform count(*) from public.search_library('force',null,'all','unit_test','tier_1','2097-04-01','2097-10-01',250);
  end loop;

  for i in 1..20 loop
    started := clock_timestamp();
    perform count(*) from public.search_library('force',null,'all',null,null,null,null,250);
    insert into public._library_search_benchmark_timing values
      ('common_answer',i,extract(epoch from clock_timestamp()-started)*1000);

    started := clock_timestamp();
    perform count(*) from public.search_library('axo52rareanswer',null,'all',null,null,null,null,250);
    insert into public._library_search_benchmark_timing values
      ('rare_answer',i,extract(epoch from clock_timestamp()-started)*1000);

    started := clock_timestamp();
    perform count(*) from public.search_library('force',offering,'all',null,null,null,null,250);
    insert into public._library_search_benchmark_timing values
      ('verified_subject',i,extract(epoch from clock_timestamp()-started)*1000);

    started := clock_timestamp();
    perform count(*) from public.search_library(
      'force',null,'all','unit_test','tier_1','2097-04-01','2097-10-01',250
    );
    insert into public._library_search_benchmark_timing values
      ('type_date_filter',i,extract(epoch from clock_timestamp()-started)*1000);
  end loop;
end $$;

select public._ls52_t(
  'all warm search families stay within 250ms p95',
  bool_and(p95_ms <= 250),
  string_agg(label || ':p50=' || round(p50_ms::numeric,2) || 'ms,p95=' || round(p95_ms::numeric,2) || 'ms', '; ')
)
from (
  select
    label,
    percentile_cont(0.50) within group (order by elapsed_ms) as p50_ms,
    percentile_cont(0.95) within group (order by elapsed_ms) as p95_ms
  from public._library_search_benchmark_timing
  group by label
) stats;

-- Generated tsvector is synchronous: there is no background indexing window.
reset role;
update public.student_attempt
set student_answer = student_answer || ' axo52freshindextoken'
where id='52100000-0000-4000-8000-000000000001';

set local role authenticated;
select public._ls52_t(
  'updated answer is immediately searchable without an async indexing wait',
  exists (
    select 1 from public.search_library(
      'axo52freshindextoken',null,'all',null,null,null,null,250
    )
    where paper_id='52000000-0000-4000-8000-000000000001'
  )
);
reset role;

-- Planner evidence for both private-answer FTS and canonical subject filtering.
do $$
declare
  plan json;
  offering uuid;
begin
  execute $plan$
    explain (format json)
    select id
    from public.student_attempt
    where search_vector @@ pg_catalog.websearch_to_tsquery('simple'::regconfig,'axo52rareanswer')
  $plan$ into plan;
  perform public._ls52_t(
    'EXPLAIN uses student_attempt_search_vector_gin',
    plan::text like '%student_attempt_search_vector_gin%',
    plan::text
  );

  select offering_id into offering from _axo52_catalog;
  execute format(
    'explain (format json) select id from public.paper where student_id=%L::uuid and subject_offering_id=%L::uuid order by date_taken desc limit 100',
    '52000000-0000-4000-8000-000000000011',
    offering::text
  ) into plan;
  perform public._ls52_t(
    'EXPLAIN uses paper_student_verified_subject_idx',
    plan::text like '%paper_student_verified_subject_idx%',
    plan::text
  );
end $$;

select
  label,
  round((percentile_cont(0.50) within group (order by elapsed_ms))::numeric,2) as p50_ms,
  round((percentile_cont(0.95) within group (order by elapsed_ms))::numeric,2) as p95_ms,
  round(max(elapsed_ms)::numeric,2) as max_ms
from public._library_search_benchmark_timing
group by label
order by label;

select
  count(*) as total,
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed
from public._library_search_benchmark_test;

select seq, name, passed, detail
from public._library_search_benchmark_test
where not passed
order by seq;

do $$
declare failures integer;
begin
  select count(*) into failures
  from public._library_search_benchmark_test
  where not passed;
  if failures > 0 then
    raise exception 'AXO-52 Library search benchmark failures: %', failures;
  end if;
end $$;

rollback;
