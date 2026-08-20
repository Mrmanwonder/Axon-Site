-- ============================================================================
-- Test suite: the extraction pipeline
-- ============================================================================
-- Covers what SCANNING_SYSTEM.md turns into constraints — provenance, the
-- mandatory review step, unreadable regions, and the way the pipeline's three
-- confidence tiers land on the database's three-value enum without punching a
-- hole in hard rule 3.
--
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/extraction_pipeline.sql
--   Pass: final SELECT reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- ── fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','ga@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','gb@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a'),
 ('bbbbbbbb-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Guardian B','b@test.invalid',now(),'stub','ref-b');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18'),
 ('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000001','Bora',12,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken, subject, reported_total, stated_maximum) values
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics',12,20),
 ('bbbbbbbb-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02','Physics',null,null);

insert into public.paper_page (paper_id, student_id, page_number, source_kind, storage_path, status,
                               quality_verdict, quality_signals, conditioning_meta)
values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',1,'upload',
        'aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-000000000003/1.jpg','stored',
        'ok','{"sharpness":0.41,"glare":0.004,"long_edge":3507}','{"dpi":300,"jpeg_quality":0.78}');

insert into public.extraction_run (id, paper_id, student_id, pipeline_version, model_versions, reconciled, reconcile_delta)
values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
        'aaaaaaaa-0000-4000-8000-000000000002','1.0.0','{"structure":"m-small","content":"m-frontier"}', true, 0);

-- ── provenance ─────────────────────────────────────────────────────────────
-- A field without provenance does not exist. This is the primary defence
-- against a vision model producing plausible fiction: a value it cannot point
-- at on the page has nowhere to be stored.

do $$ begin begin
  insert into public.question_region (run_id, paper_id, student_id, order_index, marks_awarded)
  values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
          'aaaaaaaa-0000-4000-8000-000000000002', 90, 3);
  perform public._t('a mark with no box is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('a mark with no box is refused', true);
end; end $$;

do $$ begin begin
  insert into public.question_region (run_id, paper_id, student_id, order_index, question_text)
  values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
          'aaaaaaaa-0000-4000-8000-000000000002', 91, 'State Newton''s second law.');
  perform public._t('question text with no box is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('question text with no box is refused', true);
end; end $$;

do $$ begin begin
  insert into public.question_region (run_id, paper_id, student_id, order_index,
                                      marks_awarded, marks_awarded_box, marks_available, marks_available_box)
  values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
          'aaaaaaaa-0000-4000-8000-000000000002', 92,
          7, '{"page":1,"x":10,"y":10,"w":8,"h":8}', 5, '{"page":1,"x":20,"y":10,"w":8,"h":8}');
  perform public._t('awarded above available is refused', false, 'insert succeeded');
exception when check_violation then
  perform public._t('awarded above available is refused', true);
end; end $$;

-- ── teacher marks say only what their class allows ─────────────────────────

do $$ begin begin
  insert into public.teacher_mark (run_id, paper_id, student_id, page_number, box, shape, mark_class, value)
  values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
          'aaaaaaaa-0000-4000-8000-000000000002', 1, '{"page":1,"x":1,"y":1,"w":9,"h":9}', 'crossing', 'tick', 3);
  perform public._t('only a marginal number carries a value', false, 'insert succeeded');
exception when check_violation then
  perform public._t('only a marginal number carries a value', true);
end; end $$;

do $$ begin begin
  insert into public.teacher_mark (run_id, paper_id, student_id, page_number, box, shape, mark_class, comment_text)
  values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
          'aaaaaaaa-0000-4000-8000-000000000002', 1, '{"page":1,"x":1,"y":1,"w":9,"h":9}', 'stroke', 'underline', 'see me');
  perform public._t('only a comment carries transcribed text', false, 'insert succeeded');
exception when check_violation then
  perform public._t('only a comment carries transcribed text', true);
end; end $$;

-- ── the regions this run actually found ────────────────────────────────────
-- Q1 read cleanly. Q2 is unsure and will be confirmed by the student. Q3 could
-- not be read at all. Q4 has no mark written anywhere on the page.

insert into public.question_region (
  id, run_id, paper_id, student_id, order_index, page_spans,
  question_label, question_label_box, question_text, question_text_box,
  student_answer, student_answer_box,
  marks_awarded, marks_awarded_box, marks_available, marks_available_box,
  confidence_tier, confidence_signals, needs_review
) values
 ('aaaaaaaa-0000-4000-8000-000000000021','aaaaaaaa-0000-4000-8000-000000000010',
  'aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002', 0,
  '[{"page":1,"box":{"x":40,"y":100,"w":900,"h":300}}]',
  'Q1','{"page":1,"x":40,"y":100,"w":60,"h":40}',
  'State Newton''s second law.','{"page":1,"x":110,"y":100,"w":700,"h":40}',
  'F equals m a','{"page":1,"x":40,"y":150,"w":800,"h":200}',
  4,'{"page":1,"x":980,"y":110,"w":40,"h":40}',
  5,'{"page":1,"x":900,"y":100,"w":50,"h":40}',
  'confident','{"recognition":true,"structural":true,"arithmetic":true,"plausibility":true}', false),

 ('aaaaaaaa-0000-4000-8000-000000000022','aaaaaaaa-0000-4000-8000-000000000010',
  'aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002', 1,
  '[{"page":1,"box":{"x":40,"y":420,"w":900,"h":300}}]',
  'Q2','{"page":1,"x":40,"y":420,"w":60,"h":40}',
  null,null,null,null,
  3,'{"page":1,"x":980,"y":430,"w":40,"h":40}',
  5,'{"page":1,"x":900,"y":420,"w":50,"h":40}',
  'unsure','{"recognition":false,"structural":true,"arithmetic":true,"plausibility":true}', true),

 ('aaaaaaaa-0000-4000-8000-000000000023','aaaaaaaa-0000-4000-8000-000000000010',
  'aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002', 2,
  '[{"page":1,"box":{"x":40,"y":740,"w":900,"h":260}}]',
  'Q3','{"page":1,"x":40,"y":740,"w":60,"h":40}',
  null,null,null,null,null,null,null,null,
  'unreadable','{"recognition":false,"structural":true,"arithmetic":true,"plausibility":true}', true),

 ('aaaaaaaa-0000-4000-8000-000000000024','aaaaaaaa-0000-4000-8000-000000000010',
  'aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002', 3,
  '[{"page":1,"box":{"x":40,"y":1020,"w":900,"h":200}}]',
  'Q4','{"page":1,"x":40,"y":1020,"w":60,"h":40}',
  null,null,null,null,null,null,
  5,'{"page":1,"x":900,"y":1020,"w":50,"h":40}',
  'confident','{"recognition":true,"structural":true,"arithmetic":false,"plausibility":true}', false);

-- ── review is not skippable ────────────────────────────────────────────────
-- Two regions still need the student's eyes. Committing now would put an
-- unconfirmed reading into the record, where it starts shaping insights.

do $$
declare v_err text;
begin
  begin
    perform public.commit_extraction_run('aaaaaaaa-0000-4000-8000-000000000010');
    perform public._t('commit refuses while review is outstanding', false, 'commit succeeded');
  exception when insufficient_privilege then
    get stacked diagnostics v_err = message_text;
    perform public._t('commit refuses while review is outstanding', v_err like '2 question(s)%', v_err);
  end;
end $$;

select public._t('nothing was committed by the refused attempt',
  (select count(*) = 0 from public.student_attempt
    where paper_id = 'aaaaaaaa-0000-4000-8000-000000000003'));

-- The student confirms both. A transcription correction is accepted instantly
-- and without verification — the student is the authority on their own paper.
update public.question_region
   set student_confirmed_at = now(), student_corrected = true,
       student_answer = 'F = ma, with F in newtons',
       student_answer_box = '{"page":1,"x":40,"y":470,"w":800,"h":200}'
 where id = 'aaaaaaaa-0000-4000-8000-000000000022';

update public.question_region
   set student_confirmed_at = now()
 where id = 'aaaaaaaa-0000-4000-8000-000000000023';

-- ── commit ─────────────────────────────────────────────────────────────────

do $$
declare v_result jsonb;
begin
  v_result := public.commit_extraction_run('aaaaaaaa-0000-4000-8000-000000000010');
  perform public._t('commit reports the attempts it wrote',
    (v_result ->> 'attempts_committed') = '2', v_result::text);
end $$;

select public._t('an unreadable region never becomes an attempt',
  (select committed_attempt_id is null from public.question_region
    where id = 'aaaaaaaa-0000-4000-8000-000000000023'));

select public._t('a region with no mark on the page never becomes an attempt',
  (select committed_attempt_id is null from public.question_region
    where id = 'aaaaaaaa-0000-4000-8000-000000000024'));

-- Hard rule 1, arriving through the new path: the number came off the teacher's
-- pen, and there is no enum value that would let the model be its source.
select public._t('every committed mark names a human origin',
  (select bool_and(marks_source = 'teacher_pen') from public.student_attempt
    where paper_id = 'aaaaaaaa-0000-4000-8000-000000000003'));

select public._t('a confident region commits as likely, not confirmed',
  (select a.extraction_confidence = 'likely' from public.student_attempt a
    join public.question_region r on r.committed_attempt_id = a.id
   where r.id = 'aaaaaaaa-0000-4000-8000-000000000021'));

select public._t('an unsure region commits as unsure',
  (select a.extraction_confidence = 'unsure' from public.student_attempt a
    join public.question_region r on r.committed_attempt_id = a.id
   where r.id = 'aaaaaaaa-0000-4000-8000-000000000022'));

select public._t('the student''s correction travelled with the commit',
  (select a.student_answer = 'F = ma, with F in newtons' from public.student_attempt a
    join public.question_region r on r.committed_attempt_id = a.id
   where r.id = 'aaaaaaaa-0000-4000-8000-000000000022'));

do $$ begin begin
  perform public.commit_extraction_run('aaaaaaaa-0000-4000-8000-000000000010');
  perform public._t('a run cannot be committed twice', false, 'second commit succeeded');
exception when unique_violation then
  perform public._t('a run cannot be committed twice', true);
end; end $$;

-- ── hard rule 3, through the pipeline ──────────────────────────────────────
-- The unsure region was confirmed by the student before commit, so it is
-- eligible. Take that confirmation away and it must drop straight out of the
-- analytics view without anyone having to remember to filter it.

select public._t('a confirmed unsure attempt is eligible for analytics',
  (select count(*) = 2 from public.attempt_analytics
    where paper_id = 'aaaaaaaa-0000-4000-8000-000000000003'));

update public.student_attempt set student_confirmed_at = null
 where paper_id = 'aaaaaaaa-0000-4000-8000-000000000003'
   and extraction_confidence = 'unsure';

select public._t('an unconfirmed unsure attempt never reaches analytics',
  (select count(*) = 1 from public.attempt_analytics
    where paper_id = 'aaaaaaaa-0000-4000-8000-000000000003'));

-- ── reconciliation is surfaced, never forced ───────────────────────────────
-- A paper whose arithmetic does not close still commits. What it must not do is
-- have a mark quietly adjusted to make the sum work: that produces a
-- clean-looking paper that is fictional, which is worse than an admitted gap.

update public.extraction_run
   set reconciled = false, reconcile_delta = -5
 where id = 'aaaaaaaa-0000-4000-8000-000000000010';

select public._t('an unreconciled run keeps the marks exactly as read',
  (select a.marks_awarded = 4 from public.student_attempt a
    join public.question_region r on r.committed_attempt_id = a.id
   where r.id = 'aaaaaaaa-0000-4000-8000-000000000021'));

select public._t('the delta is kept, so review can say by how much',
  (select reconcile_delta = -5 from public.extraction_run
    where id = 'aaaaaaaa-0000-4000-8000-000000000010'));

-- ── review queue order ─────────────────────────────────────────────────────
-- Unsure and unreadable first, not last. They are the reason the screen exists.

insert into public.question_region (
  run_id, paper_id, student_id, order_index, question_label, question_label_box,
  confidence_tier, needs_review
) values
 ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
  'aaaaaaaa-0000-4000-8000-000000000002', 10, 'Q11','{"page":1,"x":1,"y":1,"w":9,"h":9}','confident', false),
 ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
  'aaaaaaaa-0000-4000-8000-000000000002', 11, 'Q12','{"page":1,"x":1,"y":1,"w":9,"h":9}','unreadable', true),
 ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
  'aaaaaaaa-0000-4000-8000-000000000002', 12, 'Q13','{"page":1,"x":1,"y":1,"w":9,"h":9}','unsure', true);

select public._t('the review queue puts unreadable before unsure before the rest',
  (select array_agg(question_label order by review_rank, order_index)
     from public.review_queue
    where run_id = 'aaaaaaaa-0000-4000-8000-000000000010'
      and question_label in ('Q11','Q12','Q13')) = array['Q12','Q13','Q11']);

-- ── consent gates extraction, not just storage ─────────────────────────────
-- Withdrawal has to stop new processing, not merely hide existing rows.

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
 values ('aaaaaaaa-0000-4000-8000-000000000001', null, 'extract_text', false, 'v1.0', 'in_app_withdrawal');

do $$ begin begin
  insert into public.extraction_run (paper_id, student_id, pipeline_version)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002','1.0.0');
  perform public._t('withdrawing extract_text stops new runs', false, 'insert succeeded');
exception when insufficient_privilege then
  perform public._t('withdrawing extract_text stops new runs', true);
end; end $$;

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
 values ('aaaaaaaa-0000-4000-8000-000000000001', null, 'extract_text', true, 'v1.0', 'in_app_itemised');

-- ── RLS ────────────────────────────────────────────────────────────────────

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select public._t('another guardian sees none of these regions',
  (select count(*) = 0 from public.question_region));
select public._t('another guardian sees none of these runs',
  (select count(*) = 0 from public.extraction_run));
select public._t('another guardian sees none of these teacher marks',
  (select count(*) = 0 from public.teacher_mark));
select public._t('another guardian sees an empty review queue',
  (select count(*) = 0 from public.review_queue));

do $$ begin begin
  perform public.commit_extraction_run('aaaaaaaa-0000-4000-8000-000000000010');
  perform public._t('another guardian cannot commit this run', false, 'commit succeeded');
exception when others then
  perform public._t('another guardian cannot commit this run', true, sqlerrm);
end; end $$;

reset role;

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
