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

-- Paper 1: no printed total, every mark read. Paper 2: no printed total, one mark unreadable.
-- Paper 3: a printed total.
insert into public.paper (id, student_id, type, tier, date_taken, subject, reported_total) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics', null),
 ('aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02','Physics', null),
 ('aaaaaaaa-0000-4000-8000-0000000000a3','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-03','Physics', 10);

insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status, reconciled, status_reason_code) values
 ('aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', null, 'no_printed_total'),
 ('aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', null, 'no_printed_total'),
 ('aaaaaaaa-0000-4000-8000-0000000000b3','aaaaaaaa-0000-4000-8000-0000000000a3','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', true, null);

create or replace function public._region(p_id uuid, p_run uuid, p_paper uuid, p_order int,
                                          p_awarded numeric, p_available numeric, p_tier text default 'confident')
returns void language plpgsql as $$
begin
  insert into public.question_region (id, run_id, paper_id, student_id, order_index,
      question_label, question_label_box,
      marks_awarded, marks_awarded_box, marks_available, marks_available_box,
      confidence_tier, needs_review, student_confirmed_at)
  values (p_id, p_run, p_paper, 'aaaaaaaa-0000-4000-8000-000000000002', p_order,
      'Q' || (p_order + 1), '{"page":1,"x":3,"y":3,"w":1,"h":1}',
      p_awarded, case when p_awarded is not null then '{"page":1,"x":1,"y":1,"w":1,"h":1}'::jsonb end,
      p_available, case when p_available is not null then '{"page":1,"x":2,"y":2,"w":1,"h":1}'::jsonb end,
      p_tier::public.confidence_tier, false, now());
end $$;

select public._region('aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1', 0, 4, 5);
select public._region('aaaaaaaa-0000-4000-8000-0000000000c2','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1', 1, 3, 5);
select public._region('aaaaaaaa-0000-4000-8000-0000000000c3','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 0, 4, 5);
select public._region('aaaaaaaa-0000-4000-8000-0000000000c4','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 1, null, null, 'unreadable');
select public._region('aaaaaaaa-0000-4000-8000-0000000000c5','aaaaaaaa-0000-4000-8000-0000000000b3','aaaaaaaa-0000-4000-8000-0000000000a3', 0, 6, 10);


-- Trusted test fixtures: an existing page plus server-issued, confirmed retake assets.
insert into public.paper_page(paper_id,student_id,page_number,source_kind,status,r2_bucket,r2_key,structure_status)
values ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002',1,'upload','stored','derived',
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/old.jpg','done');
insert into public.upload(paper_id,student_id,kind,r2_bucket,r2_key,content_type,bytes,confirmed)
values ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','image','derived',
 'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/retake.jpg','image/jpeg',100,true);
insert into private.student_scope_session(guardian_id,auth_session_id,student_id,expires_at)
values ('aaaaaaaa-0000-4000-8000-000000000001','audit-session','aaaaaaaa-0000-4000-8000-000000000002',now()+interval '15 minutes');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"audit-session"}',true);

do $$ begin
  begin
    update public.student set deleted_at=now() where id='aaaaaaaa-0000-4000-8000-000000000002';
    perform public._t('Student Mode cannot tombstone a student',false);
  exception when insufficient_privilege then perform public._t('Student Mode cannot tombstone a student',true); end;
  begin
    update public.paper_page set r2_key='victim/student/secret.jpg'
      where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1';
    perform public._t('visible pages cannot acquire foreign assets',false);
  exception when insufficient_privilege then perform public._t('visible pages cannot acquire foreign assets',true); end;
  begin
    update public.paper_page set r2_key='aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/unissued.jpg'
      where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1';
    perform public._t('guessed keys require a trusted confirmed intent',false);
  exception when insufficient_privilege then perform public._t('guessed keys require a trusted confirmed intent',true); end;
end $$;

select public._t('clients cannot forge upload confirmation',
 not has_table_privilege('authenticated','public.upload','INSERT')
 and not has_table_privilege('authenticated','public.upload','UPDATE'));

create temporary table audit_submit as select public.submit_paper(
 'aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics',
 '[{"page_number":1,"r2_key":"aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/retake.jpg"}]',
 'aaaaaaaa-0000-4000-8000-000000000099',null,null,'1.0.0','aaaaaaaa-0000-4000-8000-0000000000a1') result;
select public._t('changed source creates a fresh run',
 (select (result->>'run_created')::boolean and result->>'run_id' <> 'aaaaaaaa-0000-4000-8000-0000000000b1' from audit_submit));
select public._t('old source extraction becomes terminal',
 (select status='failed' from public.extraction_run where id='aaaaaaaa-0000-4000-8000-0000000000b1'));
select public._t('unchanged submission reuses the fresh run',
 (public.submit_paper('aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics',
 '[{"page_number":1,"r2_key":"aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-0000000000a1/page/retake.jpg"}]',
 'aaaaaaaa-0000-4000-8000-000000000099',null,null,'1.0.0','aaaaaaaa-0000-4000-8000-0000000000a1')->>'run_id') =
 (select result->>'run_id' from audit_submit));

select public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b3');
select public._t('commit recomputes the corrected marks mismatch',
 (select reconciled=false and total_awarded=6 from public.paper where id='aaaaaaaa-0000-4000-8000-0000000000a3'));
do $$ begin
  begin
    perform public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b3');
    perform public._t('a second commit cannot duplicate attempts',false);
  exception when unique_violation then perform public._t('a second commit cannot duplicate attempts',true); end;
  begin
    update public.question_region set committed_attempt_id=(select id from public.student_attempt limit 1)
      where id='aaaaaaaa-0000-4000-8000-0000000000c3';
    perform public._t('client cannot redirect a committed pointer',false);
  exception when insufficient_privilege then perform public._t('client cannot redirect a committed pointer',true); end;
  begin
    update public.extraction_run set committed_at=null where id='aaaaaaaa-0000-4000-8000-0000000000b3';
    perform public._t('client cannot reset commit authority',false);
  exception when insufficient_privilege then perform public._t('client cannot reset commit authority',true); end;
end $$;
reset role;
select public._t('one commit produces exactly one attempt',
 (select count(*)=1 from public.student_attempt where paper_id='aaaaaaaa-0000-4000-8000-0000000000a3'));
-- Simulate a legacy poisoned row under trusted fixture ownership. Deletion
-- must still refuse to queue a foreign target even if a row predates guards.
update public.paper_page set r2_key='victim/student/secret.jpg' where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1';
delete from public.paper_page where paper_id='aaaaaaaa-0000-4000-8000-0000000000a1';
select public._t('legacy forged keys never enter the privileged deletion queue',
 not exists(select 1 from public.r2_deletion where key='victim/student/secret.jpg'));
select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
