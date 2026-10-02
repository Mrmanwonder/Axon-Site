-- ============================================================================
-- Test suite: AXO-121 Review-stage learning signals (delta on #169)
-- ============================================================================
-- Synthetic accounts. Guardian A granted improve_extraction; B did not.
-- Update shapes mirror src/scan/review.js. Rolls back.
--   psql "$DATABASE_URL" -f supabase/tests/axo_121_review_signals.sql
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','a1210000-1111-4111-8111-111111111111','authenticated','authenticated','a121@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','b1210000-2222-4222-8222-222222222222','authenticated','authenticated','b121@test.invalid','x',now(),now(),now());
insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('a1210000-0000-4000-8000-000000000001','a1210000-1111-4111-8111-111111111111','A','a121@test.invalid',now(),'stub','ref-a121'),
 ('b1210000-0000-4000-8000-000000000001','b1210000-2222-4222-8222-222222222222','B','b121@test.invalid',now(),'stub','ref-b121');
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp
where cp.is_required and g.id in ('a1210000-0000-4000-8000-000000000001','b1210000-0000-4000-8000-000000000001');
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method) values
 ('a1210000-0000-4000-8000-000000000001', null, 'improve_extraction', true,  'v1.0', 'in_app_itemised'),
 ('b1210000-0000-4000-8000-000000000001', null, 'improve_extraction', false, 'v1.0', 'in_app_itemised');
insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('a1210000-0000-4000-8000-000000000002','a1210000-0000-4000-8000-000000000001','Ada',11,'under_18'),
 ('b1210000-0000-4000-8000-000000000002','b1210000-0000-4000-8000-000000000001','Bo',11,'under_18');
insert into public.paper (id, student_id, type, tier, date_taken) values
 ('a1210000-0000-4000-8000-000000000003','a1210000-0000-4000-8000-000000000002','unit_test','tier_1','2026-09-30'),
 ('b1210000-0000-4000-8000-000000000003','b1210000-0000-4000-8000-000000000002','unit_test','tier_1','2026-09-30');
insert into public.extraction_run (id, paper_id, student_id, pipeline_version) values
 ('a1210000-0000-4000-8000-000000000010','a1210000-0000-4000-8000-000000000003','a1210000-0000-4000-8000-000000000002','1.0.0'),
 ('b1210000-0000-4000-8000-000000000010','b1210000-0000-4000-8000-000000000003','b1210000-0000-4000-8000-000000000002','1.0.0');
insert into public.question_region (id, run_id, paper_id, student_id, order_index, page_spans, question_label, question_label_box,
                                    student_answer, student_answer_box, marks_awarded, marks_awarded_box, marks_available, marks_available_box, confidence_tier) values
 ('a1210000-0000-4000-8000-0000000000a1','a1210000-0000-4000-8000-000000000010','a1210000-0000-4000-8000-000000000003','a1210000-0000-4000-8000-000000000002',0,
  '[{"page":1,"box":{"x":1,"y":1,"w":1,"h":1}}]','2a','{"page":1,"x":1,"y":1,"w":1,"h":1}',
  'velocity is 4 m/s','{"page":1,"x":1,"y":1,"w":1,"h":1}', 1,'{"page":1,"x":1,"y":1,"w":1,"h":1}', 3,'{"page":1,"x":1,"y":1,"w":1,"h":1}','unsure'),
 ('a1210000-0000-4000-8000-0000000000a2','a1210000-0000-4000-8000-000000000010','a1210000-0000-4000-8000-000000000003','a1210000-0000-4000-8000-000000000002',1,
  '[{"page":1,"box":{"x":1,"y":1,"w":1,"h":1}}]','2b','{"page":1,"x":1,"y":1,"w":1,"h":1}',
  null,null, 2,'{"page":1,"x":1,"y":1,"w":1,"h":1}', 2,'{"page":1,"x":1,"y":1,"w":1,"h":1}','confident'),
 ('b1210000-0000-4000-8000-0000000000b1','b1210000-0000-4000-8000-000000000010','b1210000-0000-4000-8000-000000000003','b1210000-0000-4000-8000-000000000002',0,
  '[{"page":1,"box":{"x":1,"y":1,"w":1,"h":1}}]','1','{"page":1,"x":1,"y":1,"w":1,"h":1}',
  null,null, 0,'{"page":1,"x":1,"y":1,"w":1,"h":1}', 2,'{"page":1,"x":1,"y":1,"w":1,"h":1}','unsure');

do $$
declare
  A  constant uuid := 'a1210000-0000-4000-8000-0000000000a1';
  A2 constant uuid := 'a1210000-0000-4000-8000-0000000000a2';
  B  constant uuid := 'b1210000-0000-4000-8000-0000000000b1';
  SA constant uuid := 'a1210000-0000-4000-8000-000000000002';
begin
  update public.question_region set marks_awarded = 2 where id = A;
  perform public._t('a pipeline write (no new student_confirmed_at) records nothing',
    not exists (select 1 from learning.signal where region_id = A));
  update public.question_region set marks_awarded = 1 where id = A;

  -- correctMark, then correctAnswer.
  update public.question_region set marks_awarded = 2, student_confirmed_at = now(), student_corrected = true where id = A;
  update public.question_region set student_answer = 'velocity is 4.0 m/s east', student_confirmed_at = now() + interval '1 second', student_corrected = true where id = A;
  perform public._t('each Review correction is one extract/field_corrected signal naming the field',
    (select array_agg(field::text order by id) from learning.signal where region_id = A and kind = 'field_corrected' and stage = 'extract')
      = array['marks_awarded', 'student_answer']);
  perform public._t('the signal carries the confidence the reader had, not the value',
    (select bool_and(confidence_before = 'unsure'::public.confidence_tier) from learning.signal where region_id = A));
  perform public._t('no student text or mark value appears in learning.signal',
    not exists (select 1 from learning.signal s where s::text ilike '%velocity%' or s::text ilike '%m/s%'));

  -- confirmQuestion with nothing changed.
  update public.question_region set student_confirmed_at = now() where id = A2;
  perform public._t('a no-change review is one region_confirmed signal (the calibration negative)',
    (select count(*) from learning.signal where region_id = A2 and kind = 'region_confirmed') = 1);

  -- B has not consented.
  update public.question_region set marks_awarded = 1, student_confirmed_at = now(), student_corrected = true where id = B;
  perform public._t('without improve_extraction nothing is recorded',
    not exists (select 1 from learning.signal where region_id = B));

  -- rejectCause in Review.
  insert into public.region_explanation (region_id, run_id, student_id, tier, cause, marks_lost, body, model_version, prompt_version, grounding_status)
  values (A, 'a1210000-0000-4000-8000-000000000010', SA, 'tier_1', 'keyword_miss', 1, 'x', 'm-test', 'paper_feedback.v2', 'complete');
  update public.region_explanation set cause = null, marks_lost = null where region_id = A;
  perform public._t('Review-stage "Not why I lost it" is a cause_rejected signal with the cause and prompt version',
    exists (select 1 from learning.signal where region_id = A and kind = 'cause_rejected' and stage = 'explain'
             and cause = 'keyword_miss' and prompt_version = 'paper_feedback.v2' and attempt_id is null));

  perform public._t('nothing in learning writes to public.*',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'learning' and p.prosrc ~* '(update|insert\s+into|delete\s+from)\s+public\.')
    and (select marks_awarded from public.question_region where id = A) = 2);

  -- Aggregation keeps the field dimension; counts under 5 stay unpublished.
  perform learning.aggregate();
  perform public._t('aggregates count per field, with no student id',
    (select n from learning.signal_daily where stage = 'extract' and kind = 'field_corrected' and field = 'marks_awarded') = 1);
  perform public._t('groups under 5 are not published',
    not exists (select 1 from learning.signal_counts() where field = 'marks_awarded'));

  -- Deleting the paper purges region-bound signals.
  insert into learning.signal (student_id, region_id, kind, stage, field) values (SA, A2, 'field_corrected', 'extract', 'teacher_remark'::learning.extract_field);
  delete from public.paper where id = 'a1210000-0000-4000-8000-000000000003';
  perform public._t('deleting the paper purges its region-bound signals',
    not exists (select 1 from learning.signal where region_id in (A, A2)));
end $$;

-- Withdrawal (#169 purge) also covers Review signals.
insert into public.paper (id, student_id, type, tier, date_taken) values
 ('a1210000-0000-4000-8000-000000000004','a1210000-0000-4000-8000-000000000002','unit_test','tier_1','2026-09-30');
insert into public.extraction_run (id, paper_id, student_id, pipeline_version) values
 ('a1210000-0000-4000-8000-000000000011','a1210000-0000-4000-8000-000000000004','a1210000-0000-4000-8000-000000000002','1.0.0');
insert into public.question_region (id, run_id, paper_id, student_id, order_index, page_spans, confidence_tier) values
 ('a1210000-0000-4000-8000-0000000000a3','a1210000-0000-4000-8000-000000000011','a1210000-0000-4000-8000-000000000004','a1210000-0000-4000-8000-000000000002',0,
  '[{"page":1,"box":{"x":1,"y":1,"w":1,"h":1}}]','confident');
update public.question_region set student_confirmed_at = now() where id = 'a1210000-0000-4000-8000-0000000000a3';
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('a1210000-0000-4000-8000-000000000001', null, 'improve_extraction', false, 'v1.0', 'in_app_itemised');
select public._t('withdrawing improve_extraction purges Review signals too',
  not exists (select 1 from learning.signal where student_id = 'a1210000-0000-4000-8000-000000000002'));

select public._t('purge-by-student has a covering index (advisor: unindexed FK)',
  exists (select 1 from pg_indexes where schemaname = 'learning' and indexname = 'learning_signal_student'));

select public._t('clients still have no access to learning',
  not has_schema_privilege('anon', 'learning', 'usage') and not has_schema_privilege('authenticated', 'learning', 'usage'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
