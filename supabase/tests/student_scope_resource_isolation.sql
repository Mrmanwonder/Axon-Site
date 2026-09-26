-- ============================================================================
-- AXO-61 — Student Mode resource isolation
-- ============================================================================
-- Same-guardian sibling abuse test. The authenticated household owns both
-- students; only Student A is the active Student Mode scope.
-- ============================================================================

begin;

create table public._student_resource_scope_test (
  seq serial primary key,
  name text not null,
  passed boolean not null,
  detail text
);
grant all on public._student_resource_scope_test to authenticated;
grant usage, select on sequence public._student_resource_scope_test_seq_seq to authenticated;

create or replace function public._sr_t(n text, p boolean, d text default null)
returns void
language sql
as $$ insert into public._student_resource_scope_test(name, passed, detail) values (n, p, d); $$;
grant execute on function public._sr_t(text, boolean, text) to authenticated;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '71111111-1111-4111-8111-111111111111',
  'authenticated','authenticated','scope-resources@test.invalid','x',
  now(),now(),now()
);

insert into public.guardian(
  id,auth_user_id,name,contact,verified_at,verification_method,verification_ref
) values (
  '7aaaaaaa-0000-4000-8000-000000000001',
  '71111111-1111-4111-8111-111111111111',
  'Resource Scope Guardian','scope-resources@test.invalid',
  now(),'stub','scope-resources'
);

insert into public.consent_event(
  guardian_id, student_id, purpose, granted, notice_version, method
)
select '7aaaaaaa-0000-4000-8000-000000000001', null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.consent_purpose cp
where cp.is_required;

update public.guardian
set subscription_status='pro'::public.subscription_status,
    subscription_plan='monthly'::public.subscription_plan
where id='7aaaaaaa-0000-4000-8000-000000000001';

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
 ('7aaaaaaa-0000-4000-8000-000000000002','7aaaaaaa-0000-4000-8000-000000000001','Scope A',11,'under_18'),
 ('7aaaaaaa-0000-4000-8000-000000000003','7aaaaaaa-0000-4000-8000-000000000001','Scope B',12,'under_18');

insert into public.paper(id,student_id,type,tier,date_taken,subject) values
 ('7aaaaaaa-0000-4000-8000-000000000010','7aaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1',current_date,'Physics'),
 ('7aaaaaaa-0000-4000-8000-000000000011','7aaaaaaa-0000-4000-8000-000000000003','unit_test','tier_1',current_date,'Chemistry');

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,marks_awarded,max_marks,marks_source,extraction_confidence
) values
 ('7aaaaaaa-0000-4000-8000-000000000020','7aaaaaaa-0000-4000-8000-000000000002','7aaaaaaa-0000-4000-8000-000000000010','tier_1','Q1',3,5,'teacher_pen','confirmed'),
 ('7aaaaaaa-0000-4000-8000-000000000021','7aaaaaaa-0000-4000-8000-000000000003','7aaaaaaa-0000-4000-8000-000000000011','tier_1','Q1',4,5,'teacher_pen','confirmed');

insert into public.mark_loss_event(
  id,attempt_id,student_id,cause,marks_lost,confidence,ai_explanation,grounding_status
) values
 ('7aaaaaaa-0000-4000-8000-000000000030','7aaaaaaa-0000-4000-8000-000000000020','7aaaaaaa-0000-4000-8000-000000000002','presentation',2,'likely','A','complete'),
 ('7aaaaaaa-0000-4000-8000-000000000031','7aaaaaaa-0000-4000-8000-000000000021','7aaaaaaa-0000-4000-8000-000000000003','presentation',1,'likely','B','complete');

insert into public.pattern_insight(
  id,student_id,scope,cause,subjects,paper_ids,question_count,summary_text
) values
 ('7aaaaaaa-0000-4000-8000-000000000040','7aaaaaaa-0000-4000-8000-000000000002','cross_subject','presentation',array['Physics','Math'],array['7aaaaaaa-0000-4000-8000-000000000010'::uuid],3,'A signal'),
 ('7aaaaaaa-0000-4000-8000-000000000041','7aaaaaaa-0000-4000-8000-000000000003','cross_subject','presentation',array['Chemistry','Biology'],array['7aaaaaaa-0000-4000-8000-000000000011'::uuid],3,'B signal');

insert into public.parent_progress_report(
  id,student_id,period_start,period_end,summary_text
) values
 ('7aaaaaaa-0000-4000-8000-000000000050','7aaaaaaa-0000-4000-8000-000000000002',current_date-7,current_date,'A report'),
 ('7aaaaaaa-0000-4000-8000-000000000051','7aaaaaaa-0000-4000-8000-000000000003',current_date-7,current_date,'B report');

insert into storage.objects(bucket_id,name,owner) values
 ('papers','7aaaaaaa-0000-4000-8000-000000000002/7aaaaaaa-0000-4000-8000-000000000010/1.jpg','71111111-1111-4111-8111-111111111111'),
 ('papers','7aaaaaaa-0000-4000-8000-000000000003/7aaaaaaa-0000-4000-8000-000000000011/1.jpg','71111111-1111-4111-8111-111111111111');

insert into private.academic_share(
  id,guardian_id,student_id,resource_type,paper_id,attempt_id,token_hash,expires_at
) values (
  '7aaaaaaa-0000-4000-8000-000000000070',
  '7aaaaaaa-0000-4000-8000-000000000001',
  '7aaaaaaa-0000-4000-8000-000000000003',
  'paper',
  '7aaaaaaa-0000-4000-8000-000000000011',
  null,
  digest(repeat('b',64),'sha256'),
  now()+interval '1 hour'
);

-- Establish Student A with fresh Parent Mode, then continue with the same signed
-- auth session without the fresh-auth claim.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','71111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','resource-scope-session',
    'amr',jsonb_build_array(jsonb_build_object(
      'method','oauth',
      'timestamp',floor(extract(epoch from now()))::bigint
    ))
  )::text,
  true
);
select public.set_student_scope('7aaaaaaa-0000-4000-8000-000000000002',900);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub','71111111-1111-4111-8111-111111111111',
    'role','authenticated',
    'session_id','resource-scope-session'
  )::text,
  true
);

-- ── direct same-guardian sibling reads ──────────────────────────────────────
select public._sr_t(
  'active student paper is readable',
  (select count(*) = 1 from public.paper where id='7aaaaaaa-0000-4000-8000-000000000010')
);
select public._sr_t(
  'owned sibling paper is not readable',
  (select count(*) = 0 from public.paper where id='7aaaaaaa-0000-4000-8000-000000000011')
);
select public._sr_t(
  'owned sibling attempt is not readable',
  (select count(*) = 0 from public.student_attempt where id='7aaaaaaa-0000-4000-8000-000000000021')
);
select public._sr_t(
  'owned sibling loss event is not readable',
  (select count(*) = 0 from public.mark_loss_event where id='7aaaaaaa-0000-4000-8000-000000000031')
);
select public._sr_t(
  'owned sibling progress report is not readable',
  (select count(*) = 0 from public.parent_progress_report where id='7aaaaaaa-0000-4000-8000-000000000051')
);
select public._sr_t(
  'owned sibling cross-subject insight is not readable',
  (select count(*) = 0 from public.pattern_insight where id='7aaaaaaa-0000-4000-8000-000000000041')
);
select public._sr_t(
  'owned sibling storage object is not listable',
  (select count(*) = 0 from storage.objects
    where bucket_id='papers'
      and name like '7aaaaaaa-0000-4000-8000-000000000003/%')
);

-- ── direct same-guardian sibling mutations ──────────────────────────────────
do $$ begin
  begin
    insert into public.paper(student_id,type,tier,date_taken)
    values ('7aaaaaaa-0000-4000-8000-000000000003','unit_test','tier_1',current_date);
    perform public._sr_t('cannot insert a paper for owned sibling outside scope',false,'insert succeeded');
  exception when sqlstate '42501' then
    perform public._sr_t('cannot insert a paper for owned sibling outside scope',true,sqlerrm);
  when others then
    perform public._sr_t('cannot insert a paper for owned sibling outside scope',true,sqlstate);
  end;
end $$;

do $$ declare n integer; begin
  update public.paper set subject='mutated'
   where id='7aaaaaaa-0000-4000-8000-000000000011';
  get diagnostics n = row_count;
  perform public._sr_t('sibling paper update affects no rows', n=0, 'rows='||n);
end $$;

do $$ begin
  begin
    perform public.create_link_paper(
      '7aaaaaaa-0000-4000-8000-000000000060',
      '7aaaaaaa-0000-4000-8000-000000000003',
      'unit_test',
      current_date,
      'https://example.invalid/paper'
    );
    perform public._sr_t('create_link_paper rejects sibling student id',false,'rpc succeeded');
  exception when sqlstate '42501' then
    perform public._sr_t('create_link_paper rejects sibling student id',true,sqlerrm);
  end;
end $$;

do $$ begin
  begin
    perform public.submit_paper(
      '7aaaaaaa-0000-4000-8000-000000000003',
      'unit_test',
      'tier_1',
      current_date,
      'Chemistry',
      '[]'::jsonb,
      gen_random_uuid()
    );
    perform public._sr_t('submit_paper rejects sibling student id before processing',false,'rpc succeeded');
  exception when sqlstate '42501' then
    perform public._sr_t('submit_paper rejects sibling student id before processing',true,sqlerrm);
  end;
end $$;

do $$ begin
  begin
    insert into storage.objects(bucket_id,name,owner)
    values (
      'papers',
      '7aaaaaaa-0000-4000-8000-000000000003/new/1.jpg',
      '71111111-1111-4111-8111-111111111111'
    );
    perform public._sr_t('cannot upload into owned sibling storage prefix',false,'insert succeeded');
  exception when sqlstate '42501' then
    perform public._sr_t('cannot upload into owned sibling storage prefix',true,sqlerrm);
  when others then
    perform public._sr_t('cannot upload into owned sibling storage prefix',true,sqlstate);
  end;
end $$;

-- SECURITY DEFINER analytics must not bypass either scope or Pro. This guardian
-- is Pro, so scope alone should reduce the result to Student A.
select public._sr_t(
  'cross-subject SECURITY DEFINER RPC returns only active student',
  (select count(*)=1 and min(student_id)='7aaaaaaa-0000-4000-8000-000000000002'::uuid
     from public.get_cross_subject_signal())
);

-- AXO-95 academic actions do not require a redundant Parent Mode ceremony.
-- Active Student Mode may Share/Delete its own resource, but not an owned sibling.

do $ begin
  begin
    perform public.create_academic_share(
      'paper','7aaaaaaa-0000-4000-8000-000000000011',60
    );
    perform public._sr_t('student scope cannot share sibling paper',false,'share succeeded');
  exception when sqlstate '42501' then
    perform public._sr_t('student scope cannot share sibling paper',true,sqlerrm);
  end;
end $;

do $ begin
  begin
    perform public.revoke_academic_share('7aaaaaaa-0000-4000-8000-000000000070');
    perform public._sr_t('student scope cannot revoke sibling share',false,'revoke succeeded');
  exception when sqlstate '42501' then
    perform public._sr_t('student scope cannot revoke sibling share',true,sqlerrm);
  end;
end $;

do $ begin
  begin
    perform public.delete_question('7aaaaaaa-0000-4000-8000-000000000021');
    perform public._sr_t('student scope cannot delete sibling question',false,'delete succeeded');
  exception when sqlstate '42501' then
    perform public._sr_t('student scope cannot delete sibling question',true,sqlerrm);
  end;
end $;

do $ begin
  begin
    perform public.delete_paper('7aaaaaaa-0000-4000-8000-000000000011');
    perform public._sr_t('student scope cannot delete sibling paper',false,'delete succeeded');
  exception when others then
    perform public._sr_t('student scope cannot delete sibling paper',true,sqlstate);
  end;
end $;

do $
declare created jsonb;
begin
  created := public.create_academic_share(
    'paper','7aaaaaaa-0000-4000-8000-000000000010',60
  );
  perform public._sr_t(
    'active student can create academic share without Parent Mode',
    (created->>'share_id') is not null
  );
  perform public._sr_t(
    'active student can revoke academic share without Parent Mode',
    public.revoke_academic_share((created->>'share_id')::uuid)
  );
end $;

select public._sr_t(
  'active student can delete own question without Parent Mode',
  (public.delete_question('7aaaaaaa-0000-4000-8000-000000000020')->>'deleted')::boolean
);

select public._sr_t(
  'active student can delete own paper without Parent Mode',
  (public.delete_paper('7aaaaaaa-0000-4000-8000-000000000010')->>'deleted')::boolean
);

reset role;

-- ── structural completeness: ordinary academic policies all use scope ───────
with required(tablename, policyname) as (
  values
    ('attempt_concept','attempt_concept_all_scope'),
    ('extraction_run','extraction_run_all_scope'),
    ('mark_loss_event','loss_all_scope'),
    ('page_unreadable','page_unreadable_all_scope'),
    ('paper','paper_select_scope'),
    ('paper','paper_insert_scope'),
    ('paper','paper_update_scope'),
    ('paper_page','paper_page_all_scope'),
    ('parent_progress_report','report_select_scope_pro'),
    ('pattern_insight','pattern_insight_insert_scope'),
    ('pattern_insight','pattern_insight_select_scope'),
    ('pattern_insight','pattern_insight_update_scope'),
    ('question_region','question_region_select_scope'),
    ('question_region','question_region_insert_scope'),
    ('question_region','question_region_update_scope'),
    ('region_explanation','region_explanation_all_scope'),
    ('student_attempt','attempt_select_scope'),
    ('student_attempt','attempt_insert_scope'),
    ('student_attempt','attempt_update_scope'),
    ('teacher_mark','teacher_mark_all_scope'),
    ('upload','upload_all_scope')
), observed as (
  select tablename, policyname, coalesce(qual,'')||' '||coalesce(with_check,'') as expr
  from pg_policies
  where schemaname='public'
)
select public._sr_t(
  'every required ordinary academic policy is Student Mode scoped',
  not exists (
    select 1
      from required r
      left join observed o
        on o.tablename=r.tablename and o.policyname=r.policyname
     where o.policyname is null
        or o.expr not like '%student_scope_allows%'
  )
);

select public._sr_t(
  'paper delete accepts Student Mode or stronger Parent Mode',
  exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='paper'
       and policyname='paper_delete_scope_or_parent'
       and qual like '%student_scope_allows%'
       and qual like '%has_fresh_auth%'
  )
);
select public._sr_t(
  'attempt delete accepts Student Mode or stronger Parent Mode',
  exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='student_attempt'
       and policyname='attempt_delete_scope_or_parent'
       and qual like '%student_scope_allows%'
       and qual like '%has_fresh_auth%'
  )
);
select public._sr_t(
  'question-region delete accepts Student Mode or stronger Parent Mode',
  exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='question_region'
       and policyname='question_region_delete_scope_or_parent'
       and qual like '%student_scope_allows%'
       and qual like '%has_fresh_auth%'
  )
);
select public._sr_t(
  'storage ordinary policies use Student Mode scope helper',
  (select count(*)=3
     from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname in ('papers_select_scope','papers_insert_scope','papers_update_scope')
      and (coalesce(qual,'')||' '||coalesce(with_check,'')) like '%student_scope_owns_storage_prefix%')
);
select public._sr_t(
  'storage delete accepts Student Mode or stronger Parent Mode',
  exists (
    select 1 from pg_policies
     where schemaname='storage'
       and tablename='objects'
       and policyname='papers_delete_scope_or_parent'
       and qual like '%student_scope_owns_storage_prefix%'
       and qual like '%has_fresh_auth%'
  )
);

select public._sr_t(
  'privileged academic action bodies enforce Student Mode or Parent Mode',
  (
    select count(*) = 3
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in ('delete_question','create_academic_share','revoke_academic_share')
      and pg_get_functiondef(p.oid) like '%student_scope_allows%'
      and pg_get_functiondef(p.oid) like '%has_fresh_auth%'
  )
);

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._student_resource_scope_test;

select seq,name,passed,detail
from public._student_resource_scope_test
where not passed
order by seq;

do $$
begin
  if exists (select 1 from public._student_resource_scope_test where not passed) then
    raise exception 'AXO-61 student resource scope tests failed';
  end if;
end $$;

rollback;
