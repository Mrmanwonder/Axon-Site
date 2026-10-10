-- Date corrections, actual Student Mode RLS and the shared-payload allowlist.
-- Synthetic fixtures only. Everything rolls back, including the helper objects.
begin;
create table public._r (name text, passed boolean);
grant all on public._r to authenticated, anon;
create function public._date_t(n text, p boolean) returns void language sql
as $$ insert into public._r values (n, p) $$;
grant execute on function public._date_t(text, boolean) to authenticated, anon;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','a1540000-1111-4111-8111-111111111111','authenticated','authenticated','a154@test.invalid','x',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','b1540000-2222-4222-8222-222222222222','authenticated','authenticated','b154@test.invalid','x',now(),now(),now());
insert into public.guardian(id,auth_user_id,name,contact) values
('a1540000-0000-4000-8000-000000000001','a1540000-1111-4111-8111-111111111111','Date A','a154@test.invalid'),
('b1540000-0000-4000-8000-000000000001','b1540000-2222-4222-8222-222222222222','Date B','b154@test.invalid');
insert into public.consent_event(guardian_id,student_id,purpose,granted,notice_version,method)
select g.id,null,cp.purpose,true,'v1.0','in_app_itemised'
from public.guardian g cross join public.consent_purpose cp
where cp.is_required and g.id in ('a1540000-0000-4000-8000-000000000001','b1540000-0000-4000-8000-000000000001');
insert into public.student(id,guardian_id,first_name,class_level,age_band) values
('a1540000-0000-4000-8000-000000000002','a1540000-0000-4000-8000-000000000001','A',10,'under_18'),
('a1540000-0000-4000-8000-000000000003','a1540000-0000-4000-8000-000000000001','Sibling',10,'under_18'),
('b1540000-0000-4000-8000-000000000002','b1540000-0000-4000-8000-000000000001','B',10,'under_18');
insert into public.paper(id,student_id,type,tier,date_taken) values
('a1540000-0000-4000-8000-000000000010','a1540000-0000-4000-8000-000000000002','unit_test','tier_1','2026-10-10');
insert into public.student_attempt(id,student_id,paper_id,paper_tier,question_label,marks_awarded,max_marks,marks_source,extraction_confidence) values
('a1540000-0000-4000-8000-000000000020','a1540000-0000-4000-8000-000000000002','a1540000-0000-4000-8000-000000000010','tier_1','1',1,2,'teacher_pen','confirmed'),
('a1540000-0000-4000-8000-000000000021','a1540000-0000-4000-8000-000000000002','a1540000-0000-4000-8000-000000000010','tier_1','2',1,2,'teacher_pen','unsure');
insert into private.academic_share(guardian_id,student_id,resource_type,paper_id,attempt_id,token_hash,expires_at) values
('a1540000-0000-4000-8000-000000000001','a1540000-0000-4000-8000-000000000002','paper','a1540000-0000-4000-8000-000000000010',null,extensions.digest(repeat('a',64),'sha256'),now()+interval '1 hour'),
('a1540000-0000-4000-8000-000000000001','a1540000-0000-4000-8000-000000000002','question','a1540000-0000-4000-8000-000000000010','a1540000-0000-4000-8000-000000000020',extensions.digest(repeat('b',64),'sha256'),now()+interval '1 hour'),
('a1540000-0000-4000-8000-000000000001','a1540000-0000-4000-8000-000000000002','question','a1540000-0000-4000-8000-000000000010','a1540000-0000-4000-8000-000000000021',extensions.digest(repeat('c',64),'sha256'),now()+interval '1 hour');

select public._date_t('existing upload date is not backfilled as an exam date',
 (select exam_date is null from public.paper where id='a1540000-0000-4000-8000-000000000010'));
select public._date_t('date setter is invoker with authenticated-only client execution',
 not (select prosecdef from pg_proc where oid='public.set_paper_exam_date(uuid,date)'::regprocedure)
 and not has_function_privilege('anon','public.set_paper_exam_date(uuid,date)','execute')
 and has_function_privilege('authenticated','public.set_paper_exam_date(uuid,date)','execute'));

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','a1540000-1111-4111-8111-111111111111','role','authenticated','session_id','axo154-a',
 'amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',extract(epoch from now())::bigint)))::text,true);
do $$ begin
 perform public.set_paper_exam_date('a1540000-0000-4000-8000-000000000010','2026-09-30');
 perform public._date_t('owner without Student Mode is refused',false);
exception when insufficient_privilege then perform public._date_t('owner without Student Mode is refused',true);
end $$;
select public.set_student_scope('a1540000-0000-4000-8000-000000000002',900);
select public.set_paper_exam_date('a1540000-0000-4000-8000-000000000010','2026-09-30');
select public._date_t('owner correction preserves upload history',
 (select exam_date=date '2026-09-30' and date_taken=date '2026-10-10' from public.paper where id='a1540000-0000-4000-8000-000000000010'));
do $$ begin
 perform public.set_paper_exam_date('a1540000-0000-4000-8000-000000000010','infinity');
 perform public._date_t('infinite exam dates are refused',false);
exception when check_violation then perform public._date_t('infinite exam dates are refused',true);
end $$;
select public.set_student_scope('a1540000-0000-4000-8000-000000000003',900);
do $$ begin
 perform public.set_paper_exam_date('a1540000-0000-4000-8000-000000000010','2026-09-01');
 perform public._date_t('sibling scope cannot change the date',false);
exception when insufficient_privilege then perform public._date_t('sibling scope cannot change the date',true);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub','b1540000-2222-4222-8222-222222222222','role','authenticated','session_id','axo154-b',
 'amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',extract(epoch from now())::bigint)))::text,true);
select public.set_student_scope('b1540000-0000-4000-8000-000000000002',900);
do $$ begin
 perform public.set_paper_exam_date('a1540000-0000-4000-8000-000000000010','2026-09-01');
 perform public._date_t('another guardian cannot change the date',false);
exception when insufficient_privilege then perform public._date_t('another guardian cannot change the date',true);
end $$;
do $$ begin
 update public.paper set exam_date='2026-09-01' where id='a1540000-0000-4000-8000-000000000010';
 perform public._date_t('direct table writes cannot bypass ownership',not found);
end $$;
reset role;
set local role anon;
do $$ begin
 perform public.set_paper_exam_date('a1540000-0000-4000-8000-000000000010','2026-09-01');
 perform public._date_t('anonymous date correction is denied',false);
exception when insufficient_privilege then perform public._date_t('anonymous date correction is denied',true);
end $$;
select public._date_t('paper and both question share states carry the same date',
 (public.resolve_academic_share(repeat('a',64))#>>'{paper,exam_date}')='2026-09-30'
 and (public.resolve_academic_share(repeat('b',64))#>>'{paper,exam_date}')='2026-09-30'
 and (public.resolve_academic_share(repeat('c',64))#>>'{paper,exam_date}')='2026-09-30');
select public._date_t('sharing still withholds unsure content and private student identifiers',
 (public.resolve_academic_share(repeat('c',64))->>'withheld')::boolean
 and not (public.resolve_academic_share(repeat('c',64)) ? 'question')
 and not (public.resolve_academic_share(repeat('a',64))->'paper' ? 'student_id')
 and jsonb_array_length(public.resolve_academic_share(repeat('a',64))->'questions')=1);
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','a1540000-1111-4111-8111-111111111111','role','authenticated','session_id','axo154-a',
 'amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',extract(epoch from now())::bigint)))::text,true);
select public.set_student_scope('a1540000-0000-4000-8000-000000000002',900);
select public.set_paper_exam_date('a1540000-0000-4000-8000-000000000010',null);
select public._date_t('clearing restores unknown while preserving the added date',
 (select exam_date is null and date_taken=date '2026-10-10' from public.paper where id='a1540000-0000-4000-8000-000000000010'));
select public._date_t('existing shared links reflect a cleared date',
 (public.resolve_academic_share(repeat('a',64))#>'{paper,exam_date}')='null'::jsonb);
reset role;
do $$ begin
 if exists(select 1 from public._r where passed is distinct from true) then
   raise exception 'Exam date regression failed: %',(select string_agg(name,', ') from public._r where passed is distinct from true);
 end if;
end $$;
select count(*) as total,count(*) filter(where passed) as passed,count(*) filter(where passed is distinct from true) as failed from public._r;
rollback;
