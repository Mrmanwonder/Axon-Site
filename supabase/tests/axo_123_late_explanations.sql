-- ============================================================================
-- Test suite: AXO-123 explanations that finish after commit reach the card
-- ============================================================================
--   Rolls back; safe against any database.
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_123_late_explanations.sql
--   Pass: the counts line reports failed = 0.
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
insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18');
insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics');
insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status, reconciled) values
 ('aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', true);

create or replace function public._region(p_id uuid, p_order int, p_awarded numeric, p_available numeric)
returns void language plpgsql as $$
begin
  insert into public.question_region (id, run_id, paper_id, student_id, order_index,
      question_label, question_label_box, marks_awarded, marks_awarded_box, marks_available, marks_available_box,
      confidence_tier, needs_review, student_confirmed_at)
  values (p_id, 'aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1',
      'aaaaaaaa-0000-4000-8000-000000000002', p_order,
      'Q' || (p_order + 1), '{"page":1,"x":3,"y":3,"w":1,"h":1}',
      p_awarded, '{"page":1,"x":1,"y":1,"w":1,"h":1}', p_available, '{"page":1,"x":2,"y":2,"w":1,"h":1}',
      'confident', false, now());
end $$;

-- Q1 and Q2 lose marks and have NO explanation at commit time (the explanation failed or is pending).
select public._region('aaaaaaaa-0000-4000-8000-0000000000c1', 0, 1, 3);
select public._region('aaaaaaaa-0000-4000-8000-0000000000c2', 1, 2, 3);

select public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b1');

select public._t('committed with no explanation: no loss row yet',
  (select count(*) = 0 from public.mark_loss_event
    where attempt_id in (select committed_attempt_id from public.question_region where run_id = 'aaaaaaaa-0000-4000-8000-0000000000b1')));

-- The explanation arrives after commit (a retry).
insert into public.region_explanation (region_id, run_id, student_id, tier, cause, marks_lost, body, do_this_next,
    model_version, prompt_version, grounding_status)
values ('aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-000000000002',
    'tier_1','procedural_slip', 2, 'First explanation.', 'Write the formula on its own line.', 'gemini-3.8-flash', 'paper_feedback.v2', 'complete');

select public._t('a late explanation reaches the committed attempt as a mark_loss_event row',
  (select count(*) = 1 and bool_and(cause = 'procedural_slip' and ai_explanation = 'First explanation.' and marks_lost = 2)
     from public.mark_loss_event m join public.question_region q on q.committed_attempt_id = m.attempt_id
    where q.id = 'aaaaaaaa-0000-4000-8000-0000000000c1'));

select public._t('only the explained question gets a row',
  (select count(*) = 1 from public.mark_loss_event
    where attempt_id in (select committed_attempt_id from public.question_region where run_id = 'aaaaaaaa-0000-4000-8000-0000000000b1')));

-- A regenerated explanation updates the same row, and clears a stale confirmation.
update public.mark_loss_event set student_confirmed_at = now()
 where attempt_id = (select committed_attempt_id from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c1');
update public.region_explanation set body = 'Second explanation.' where region_id = 'aaaaaaaa-0000-4000-8000-0000000000c1';

select public._t('a regenerated explanation updates the existing row (no duplicate)',
  (select count(*) = 1 and bool_and(ai_explanation = 'Second explanation.') from public.mark_loss_event m
    where m.attempt_id = (select committed_attempt_id from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c1')));
select public._t('a changed explanation clears the confirmation of the old one',
  (select student_confirmed_at is null from public.mark_loss_event m
    where m.attempt_id = (select committed_attempt_id from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c1')));

-- A rejected cause is the student's word and is not overwritten.
update public.mark_loss_event set student_rejected_at = now()
 where attempt_id = (select committed_attempt_id from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c1');
update public.region_explanation set body = 'Third explanation.' where region_id = 'aaaaaaaa-0000-4000-8000-0000000000c1';
select public._t('a rejected row keeps its text; a fresh live row is offered beside it',
  (select count(*) filter (where student_rejected_at is not null and ai_explanation = 'Second explanation.') = 1
      and count(*) filter (where student_rejected_at is null and ai_explanation = 'Third explanation.') = 1
     from public.mark_loss_event m
    where m.attempt_id = (select committed_attempt_id from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c1')));

-- Before commit nothing is copied by the trigger (commit does it).
insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status, reconciled) values
 ('aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', true);
insert into public.question_region (id, run_id, paper_id, student_id, order_index, question_label, question_label_box,
    marks_awarded, marks_awarded_box, marks_available, marks_available_box, confidence_tier, needs_review, student_confirmed_at)
values ('aaaaaaaa-0000-4000-8000-0000000000c9','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a1',
  'aaaaaaaa-0000-4000-8000-000000000002', 0, 'Q9','{"page":1,"x":3,"y":3,"w":1,"h":1}',1,'{"page":1,"x":1,"y":1,"w":1,"h":1}',3,'{"page":1,"x":2,"y":2,"w":1,"h":1}','confident', false, now());
insert into public.region_explanation (region_id, run_id, student_id, tier, cause, marks_lost, body, model_version, prompt_version, grounding_status)
values ('aaaaaaaa-0000-4000-8000-0000000000c9','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-000000000002','tier_1','conceptual_gap',2,'Pre-commit.','gemini-3.8-flash','paper_feedback.v2','complete');
select public._t('before commit the trigger copies nothing',
  (select count(*) = 0 from public.mark_loss_event where ai_explanation = 'Pre-commit.'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
