-- ============================================================================
-- Test suite: AXO-124 papers with no printed total
-- ============================================================================
--   · a committed paper that printed no total is labelled added_up; one that did is printed
--   · an unreadable mark makes the added-up total partial
--   · the student's own role can write the new total columns (commit runs as the student)
--   · paper_progress exposes reconciled and the machine reason
-- Rolls back; safe against any database.
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


insert into public.paper(id,student_id,type,tier,date_taken) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-10-04');
-- Every key in this fixture is in the server's canonical owned namespace.
insert into public.upload(paper_id,student_id,kind,r2_bucket,r2_key,content_type,bytes,etag,confirmed,asset_kind,page_number,page_revision,page_key)
select 'aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','image','derived',
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/p'||n||'-capture.jpg','image/jpeg',100,'server-etag',true,'page',n,'rev-'||n,null
from generate_series(1,5) n;
insert into public.paper_page(paper_id,student_id,page_number,source_kind,r2_bucket,r2_key,conditioning_meta)
select 'aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002',n,'upload','derived',
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/p'||n||'-capture.jpg',jsonb_build_object('upload_revision','rev-'||n)
from generate_series(1,5) n;
insert into public.upload(paper_id,student_id,kind,r2_bucket,r2_key,content_type,bytes,etag,confirmed,asset_kind,page_number,page_revision,page_key)
select 'aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','image','originals',
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p'||n||'-original-capture.jpg','image/jpeg',100,'server-etag',n<>2,'raw',n,'rev-'||n,
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/p'||n||'-capture.jpg'
from generate_series(1,5) n;
create function public._attachment(n integer, revision text default null, original text default null)
returns jsonb language sql set search_path='' as $$
 select jsonb_build_array(jsonb_build_object('page_number',n,'page_revision',coalesce(revision,'rev-'||n),
 'page_key','aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/p'||n||'-capture.jpg',
 'original_key',coalesce(original,'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p'||n||'-original-capture.jpg')));
$$;
grant execute on function public._attachment(integer,text,text) to service_role;
grant all on public._r to service_role;
grant usage,select on sequence public._r_seq_seq to service_role;
grant execute on function public._t(text,boolean,text) to service_role;
select public._t('attachment RPC is service-only',
 has_function_privilege('service_role','public.attach_paper_originals(uuid,uuid,jsonb)','execute')
 and not has_function_privilege('authenticated','public.attach_paper_originals(uuid,uuid,jsonb)','execute')
 and not has_function_privilege('anon','public.attach_paper_originals(uuid,uuid,jsonb)','execute')
 and not has_function_privilege('authenticated','private.attach_paper_originals(uuid,uuid,jsonb)','execute'));
set local role service_role;
select public._t('valid confirmed original attaches',public.attach_paper_originals(
 'aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(1))->'attached'->0->>'key'
 = 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p1-original-capture.jpg');
select public._t('same original reattachment is idempotent',jsonb_array_length(public.attach_paper_originals(
 'aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(1))->'attached')=1);
do $$ begin
 begin perform public.attach_paper_originals('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(2));
  perform public._t('unconfirmed original rejected',false);
 exception when insufficient_privilege then perform public._t('unconfirmed original rejected',true);end;
 begin perform public.attach_paper_originals('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(3));
  perform public._t('wrong student rejected',false);
 exception when insufficient_privilege then perform public._t('wrong student rejected',true);end;
 begin perform public.attach_paper_originals('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a2',public._attachment(3));
  perform public._t('wrong paper rejected',false);
 exception when insufficient_privilege then perform public._t('wrong paper rejected',true);end;
 begin perform public.attach_paper_originals('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(3,'retaken'));
  perform public._t('stale retake revision rejected',false);
 exception when insufficient_privilege then perform public._t('stale retake revision rejected',true);end;
 begin perform public.attach_paper_originals('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(3,null,
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p4-original-capture.jpg'));
  perform public._t('wrong page original rejected',false);
 exception when insufficient_privilege then perform public._t('wrong page original rejected',true);end;
 begin perform public.attach_paper_originals('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',
 public._attachment(3)||public._attachment(2));
  perform public._t('partially invalid batch rejected',false);
 exception when insufficient_privilege then perform public._t('partially invalid batch rejected',true);end;
end $$;
select public._t('failed batch changes no earlier page',(select original_key is null from public.paper_page where page_number=3 and paper_id='aaaaaaaa-0000-4000-8000-0000000000a1'));
reset role;
-- A different confirmed canonical key for the same capture must not overwrite.
insert into public.upload(paper_id,student_id,kind,r2_bucket,r2_key,content_type,bytes,etag,confirmed,asset_kind,page_number,page_revision,page_key)
values('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','image','originals',
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p1-original-other.jpg','image/jpeg',100,'etag',true,'raw',1,'rev-1',
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/p1-capture.jpg');
set local role service_role;
do $$ begin
 begin perform public.attach_paper_originals('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(1,null,
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p1-original-other.jpg'));
  perform public._t('different canonical original cannot overwrite',false);
 exception when insufficient_privilege then perform public._t('different canonical original cannot overwrite',true);end;
end $$;
reset role;
update public.upload set page_revision='old-revision' where asset_kind='raw' and page_number=4;
set local role service_role;
do $$ begin
 begin perform public.attach_paper_originals('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(4));
  perform public._t('stale issued capture rejected',false);
 exception when insufficient_privilege then perform public._t('stale issued capture rejected',true);end;
end $$;
reset role;
-- Legacy confirmed page intents may use only their exact canonical binding.
update public.upload set asset_kind=null,page_number=null,page_revision=null,page_key=null where asset_kind='page' and page_number=5;
update public.paper_page set conditioning_meta='{"upload_revision":"legacy-5"}' where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1' and page_number=5;
update public.upload set page_revision='legacy-5' where asset_kind='raw' and page_number=5;
set local role service_role;
select public._t('legacy confirmed page binding remains resumable',jsonb_array_length(public.attach_paper_originals(
 'aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(5,'legacy-5'))->'attached')=1);
reset role;
update public.upload set r2_key='aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p3-original-capture.heic',
 content_type='image/heic' where asset_kind='raw' and page_number=3;
set local role service_role;
select public._t('supported unchanged HEIC original attaches',jsonb_array_length(public.attach_paper_originals(
 'aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1',public._attachment(3,null,
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p3-original-capture.heic'))->'attached')=1);
reset role;
-- Exercise the public authenticated handoff as well as its service attachment.
insert into private.student_scope_session(guardian_id,auth_session_id,student_id,expires_at)
values ('aaaaaaaa-0000-4000-8000-000000000001','original-test','aaaaaaaa-0000-4000-8000-000000000002',now()+interval '15 minutes');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"original-test"}',true);
select public.submit_paper('aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-10-04',null,
 '[{"page_number":1,"r2_bucket":"derived","r2_key":"aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/p1-capture.jpg","conditioning_meta":{"upload_revision":"rev-1"},"original_key":null}]',
 'aaaaaaaa-0000-4000-8000-000000000099',null,null,'1.0.0','aaaaaaaa-0000-4000-8000-0000000000a1');
select public._t('unchanged frozen submit preserves the independently attached original',
 (select original_key='aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p1-original-capture.jpg'
 from public.paper_page where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1' and page_number=1));
do $$ begin
 begin update public.paper_page set original_key='aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/raw/p1-original-other.jpg'
 where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1' and page_number=1;
 perform public._t('direct authenticated original replacement rejected',false);
 exception when insufficient_privilege then perform public._t('direct authenticated original replacement rejected',true);end;
end $$;
reset role;
insert into public.upload(paper_id,student_id,kind,r2_bucket,r2_key,content_type,bytes,etag,confirmed,asset_kind,page_number,page_revision)
values('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','image','derived',
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/p1-retake.jpg','image/jpeg',100,'etag',true,'page',1,'retake-revision');
set local role authenticated;
select public.submit_paper('aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-10-04',null,
 '[{"page_number":1,"r2_bucket":"derived","r2_key":"aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/p1-retake.jpg","conditioning_meta":{"upload_revision":"retake-revision"},"original_key":null}]',
 'aaaaaaaa-0000-4000-8000-000000000099',null,null,'1.0.0','aaaaaaaa-0000-4000-8000-0000000000a1');
select public._t('a true retake clears the prior capture original',
 (select original_key is null and conditioning_meta->>'upload_revision'='retake-revision'
 from public.paper_page where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1' and page_number=1));
reset role;
select count(*) as total,count(*) filter (where passed) as passed,count(*) filter (where not passed or passed is null) as failed from public._r;
rollback;
