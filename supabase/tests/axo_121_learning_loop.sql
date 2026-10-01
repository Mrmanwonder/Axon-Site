-- ============================================================================
-- Test suite: AXO-121 learning loop
-- ============================================================================
-- Synthetic fixtures. Guardian A has granted improve_extraction; guardian B has
-- not. Rolls back; safe against any database.
--   psql "$DATABASE_URL" -f supabase/tests/axo_121_learning_loop.sql
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
  v_attempt uuid;
  v_mle uuid;
  v_keys text[];
begin
  -- A pipeline write is not a review.
  update public.question_region set marks_awarded = 2 where id = A;
  perform public._t('a pipeline write (no student_confirmed_at) records nothing',
    not exists (select 1 from learning.correction_event where region_id = A));
  update public.question_region set marks_awarded = 1 where id = A;

  -- The two correction shapes the frontend actually sends (src/scan/review.js).
  update public.question_region set marks_awarded = 2, student_confirmed_at = now(), student_corrected = true where id = A;
  update public.question_region set student_answer = 'velocity is 4.0 m/s east', student_confirmed_at = now() + interval '1 second', student_corrected = true where id = A;

  perform public._t('each changed reviewed field is one field_corrected event',
    (select array_agg(field order by id) from learning.correction_event where region_id = A and kind = 'field_corrected')
      = array['marks_awarded', 'student_answer']);
  perform public._t('marks keep their values (predicted 1 → accepted 2) and the prior confidence',
    exists (select 1 from learning.correction_event where region_id = A and field = 'marks_awarded'
             and predicted = '1'::jsonb and accepted = '2'::jsonb and confidence_before = 'unsure'));
  perform public._t('free text is stored as lengths only',
    exists (select 1 from learning.correction_event where region_id = A and field = 'student_answer'
             and predicted = '{"length": 17}'::jsonb and accepted = '{"length": 24}'::jsonb));
  perform public._t('no student text appears anywhere in the learning store',
    not exists (select 1 from learning.correction_event e
                 where e::text ilike '%velocity%' or e::text ilike '%m/s%'));

  -- A confirmation that changes nothing is the negative calibration needs.
  update public.question_region set student_confirmed_at = now() where id = A2;
  perform public._t('a no-change review is one region_confirmed event',
    (select count(*) from learning.correction_event where region_id = A2 and kind = 'region_confirmed') = 1
    and not exists (select 1 from learning.correction_event where region_id = A2 and kind = 'field_corrected'));

  perform public._t('with improve_extraction granted, corrections are queued for all four uses',
    (select count(*) from learning.queue_item qi join learning.correction_event e on e.id = qi.correction_event_id
      where e.region_id = A and qi.state = 'QUEUED') = 8);
  perform public._t('a confirmation is queued for recalibration only',
    (select array_agg(qi.target) from learning.queue_item qi join learning.correction_event e on e.id = qi.correction_event_id
      where e.region_id = A2) = array['CONFIDENCE_RECALIBRATION']);

  -- Guardian B never granted improve_extraction.
  update public.question_region set marks_awarded = 1, student_confirmed_at = now(), student_corrected = true where id = B;
  perform public._t('without consent the operational event exists but nothing is queued',
    exists (select 1 from learning.correction_event where region_id = B)
    and not exists (select 1 from learning.queue_item qi join learning.correction_event e on e.id = qi.correction_event_id where e.region_id = B));

  select array_agg(distinct student_key) into v_keys from learning.correction_event where region_id in (A, A2);
  perform public._t('one stable HMAC pseudonym per student, never the student id',
    array_length(v_keys, 1) = 1 and v_keys[1] ~ '^[0-9a-f]{64}$'
    and v_keys[1] <> 'a1210000-0000-4000-8000-000000000002'
    and v_keys[1] <> (select student_key from learning.correction_event where region_id = B limit 1));

  perform public._t('the correction did not touch anything but what the student sent',
    (select marks_awarded from public.question_region where id = A) = 2
    and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'learning' and p.prosrc ~* '(update|insert\s+into|delete\s+from)\s+public\.'));

  -- Explanation feedback: "Not why I lost it".
  insert into public.student_attempt (student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence)
  values ('a1210000-0000-4000-8000-000000000002','a1210000-0000-4000-8000-000000000003','tier_1','2a',2,3,'teacher_pen','confirmed')
  returning id into v_attempt;
  update public.question_region set committed_attempt_id = v_attempt where id = A;
  insert into public.mark_loss_event (attempt_id, student_id, cause, marks_lost, confidence, grounding_status)
  values (v_attempt, 'a1210000-0000-4000-8000-000000000002', 'presentation', 1, 'likely', 'complete') returning id into v_mle;
  update public.mark_loss_event set student_rejected_at = now() where id = v_mle;
  perform public._t('"Not why I lost it" is an explanation_rejected event carrying the rejected cause',
    exists (select 1 from learning.correction_event where mark_loss_event_id = v_mle and kind = 'explanation_rejected'
             and field = 'cause' and predicted = '"presentation"'::jsonb and region_id = A));

  -- The Review-stage path: rejectCause() clears region_explanation.cause.
  insert into public.region_explanation (region_id, run_id, student_id, tier, cause, marks_lost, body, model_version, prompt_version, grounding_status)
  values (A, 'a1210000-0000-4000-8000-000000000010', 'a1210000-0000-4000-8000-000000000002', 'tier_1', 'keyword_miss', 1, 'x', 'm-test', 'paper_feedback.v2', 'complete');
  update public.region_explanation set cause = null, marks_lost = null where region_id = A;
  perform public._t('Review-stage "Not why I lost it" is recorded with the cause and prompt version it rejected',
    exists (select 1 from learning.correction_event where region_id = A and kind = 'explanation_rejected'
             and predicted = '"keyword_miss"'::jsonb and prompt_version = 'paper_feedback.v2' and mark_loss_event_id is null));

  -- Withdrawal.
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('a1210000-0000-4000-8000-000000000001', null, 'improve_extraction', false, 'v1.0', 'in_app_itemised');
  perform public._t('withdrawing improve_extraction rejects every queued item at once',
    not exists (select 1 from learning.queue_item qi join learning.correction_event e on e.id = qi.correction_event_id
                 left join public.question_region qr on qr.id = e.region_id
                 where qr.student_id = 'a1210000-0000-4000-8000-000000000002' and qi.state <> 'REJECTED'));
  update public.question_region set student_confirmed_at = now() + interval '1 minute' where id = A2;
  perform public._t('after withdrawal new reviews are recorded but never queued',
    (select count(*) from learning.queue_item qi join learning.correction_event e on e.id = qi.correction_event_id
      where e.region_id = A2 and qi.state = 'QUEUED') = 0);

  -- Deletion.
  delete from public.paper where id = 'a1210000-0000-4000-8000-000000000003';
  perform public._t('deleting the paper purges its learning events and queue items',
    not exists (select 1 from learning.correction_event where region_id in (A, A2) or mark_loss_event_id = v_mle));
end $$;

do $$ begin
  perform public._t('clients have no access to the learning schema',
    not has_schema_privilege('anon', 'learning', 'usage') and not has_schema_privilege('authenticated', 'learning', 'usage'));
  perform public._t('the pseudonym key exists in Vault, not in a table',
    exists (select 1 from vault.secrets where name = 'learning_pseudonym_key'));
end $$;

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
