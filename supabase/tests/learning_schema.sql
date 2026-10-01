-- ============================================================================
-- Test suite: learning signals
-- ============================================================================
--   · no raw text can be stored (no text column other than enums / version strings)
--   · nothing is recorded without live improve_extraction consent
--   · cause verdicts are recorded from the existing columns; one explanation verdict per attempt
--   · aggregation counts each signal once; small groups are suppressed
--   · purge: deleting a question, soft-deleting a student, withdrawing consent
--   · clients cannot read the schema or call the internals
--
-- Rolls back; safe against any database.
--   Run:  psql "$DATABASE_URL" -f supabase/tests/learning_schema.sql
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

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics');

insert into public.student_attempt (id, student_id, paper_id, paper_tier, question_label, question_text, student_answer,
    marks_awarded, max_marks, marks_source, extraction_confidence, student_confirmed_at)
values
 ('aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1','tier_1','Q1','State it.','x', 1, 3, 'teacher_pen','likely', now()),
 ('aaaaaaaa-0000-4000-8000-0000000000c2','aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1','tier_1','Q2','State it.','x', 1, 3, 'teacher_pen','likely', now());

insert into public.mark_loss_event (id, attempt_id, student_id, cause, marks_lost, ai_explanation, confidence, grounding_status) values
 ('aaaaaaaa-0000-4000-8000-0000000000d1','aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-000000000002','procedural_slip', 2, 'e1', 'likely', 'complete'),
 ('aaaaaaaa-0000-4000-8000-0000000000d2','aaaaaaaa-0000-4000-8000-0000000000c2','aaaaaaaa-0000-4000-8000-000000000002','conceptual_gap', 2, 'e2', 'likely', 'complete');

-- ── privacy by construction ────────────────────────────────────────────────

select public._t('learning.signal has no free-text column (only ids, enums, version strings, timestamps)',
  (select count(*) = 0 from information_schema.columns
    where table_schema = 'learning' and table_name = 'signal'
      and data_type = 'text' and column_name not in ('kind', 'stage', 'prompt_version')),
  (select string_agg(column_name, ',') from information_schema.columns
    where table_schema = 'learning' and table_name = 'signal' and data_type = 'text'
      and column_name not in ('kind', 'stage', 'prompt_version')));

select public._t('prompt_version cannot carry prose',
  (select count(*) = 1 from pg_constraint c
    where c.conrelid = 'learning.signal'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%prompt_version%~%'));

-- ── consent gate ───────────────────────────────────────────────────────────

update public.mark_loss_event set student_rejected_at = now() where id = 'aaaaaaaa-0000-4000-8000-0000000000d1';
select public._t('no consent for improve_extraction: a rejected cause records nothing',
  (select count(*) = 0 from learning.signal));

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method) values
 ('aaaaaaaa-0000-4000-8000-000000000001', null, 'improve_extraction', true, 'v1.0', 'in_app_itemised');

update public.mark_loss_event set student_confirmed_at = now() where id = 'aaaaaaaa-0000-4000-8000-0000000000d2';
select public._t('with consent: a confirmed cause is recorded with its cause and no text',
  (select count(*) = 1 and bool_and(kind = 'cause_confirmed' and cause = 'conceptual_gap') from learning.signal));

-- A fresh attempt/loss pair for the rejection, since d1 was already rejected before consent.
insert into public.student_attempt (id, student_id, paper_id, paper_tier, question_label, question_text, student_answer,
    marks_awarded, max_marks, marks_source, extraction_confidence, student_confirmed_at)
values ('aaaaaaaa-0000-4000-8000-0000000000c3','aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000a1','tier_1','Q3','State it.','x', 0, 2, 'teacher_pen','likely', now());
insert into public.mark_loss_event (id, attempt_id, student_id, cause, marks_lost, ai_explanation, confidence, grounding_status) values
 ('aaaaaaaa-0000-4000-8000-0000000000d3','aaaaaaaa-0000-4000-8000-0000000000c3','aaaaaaaa-0000-4000-8000-000000000002','keyword_miss', 2, 'e3', 'likely', 'complete');
update public.mark_loss_event set student_rejected_at = now() where id = 'aaaaaaaa-0000-4000-8000-0000000000d3';
select public._t('with consent: "not why I lost it" is recorded as cause_rejected',
  (select count(*) = 1 from learning.signal where kind = 'cause_rejected' and cause = 'keyword_miss'));

-- ── the helped / was-wrong control ─────────────────────────────────────────

select public._t('clients cannot call the internals or read the schema',
  not has_function_privilege('authenticated', 'learning.aggregate()', 'execute')
  and not has_function_privilege('authenticated', 'learning.purge_student(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'learning.signal_counts(date)', 'execute')
  and not has_schema_privilege('authenticated', 'learning', 'usage')
  and not has_schema_privilege('anon', 'learning', 'usage'));

select public._t('the feedback RPC is callable by authenticated only',
  has_function_privilege('authenticated', 'public.record_explanation_feedback(uuid, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.record_explanation_feedback(uuid, boolean)', 'execute'));

do $$
declare v_err text;
begin
  begin
    perform public.record_explanation_feedback('aaaaaaaa-0000-4000-8000-0000000000c1', true);
    perform public._t('feedback without Student Mode scope is refused', false, 'call succeeded');
  exception when insufficient_privilege then
    perform public._t('feedback without Student Mode scope is refused', true);
  end;
end $$;

-- Verdicts written the way the RPC writes them (it needs a live Student Mode session to call).
insert into learning.signal (student_id, attempt_id, kind, cause) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000c1','explanation_helped','procedural_slip');

do $$
begin
  begin
    insert into learning.signal (student_id, attempt_id, kind, cause) values
     ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000c1','explanation_wrong','procedural_slip');
    perform public._t('a second explanation verdict for the same attempt is a conflict (the RPC upserts)', false, 'insert succeeded');
  exception when unique_violation then
    perform public._t('a second explanation verdict for the same attempt is a conflict (the RPC upserts)', true);
  end;
end $$;

-- ── aggregation ────────────────────────────────────────────────────────────

create temp table _agg as select learning.aggregate() as n;
select public._t('aggregate() counts every unaggregated signal once',
  (select n = 3 from _agg), (select n::text from _agg));
select public._t('a second aggregate() finds nothing left to count',
  learning.aggregate() = 0);
select public._t('no signal is left unaggregated',
  (select count(*) = 0 from learning.signal where aggregated_at is null));
select public._t('signal_daily holds counts only',
  (select sum(n) = 3 from learning.signal_daily));
select public._t('groups under 5 are not published by signal_counts()',
  (select count(*) = 0 from learning.signal_counts(current_date - 1)));

-- ── purge ──────────────────────────────────────────────────────────────────

delete from public.student_attempt where id = 'aaaaaaaa-0000-4000-8000-0000000000c3';
select public._t('deleting a question purges its signals',
  (select count(*) = 0 from learning.signal where attempt_id = 'aaaaaaaa-0000-4000-8000-0000000000c3'));

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method) values
 ('aaaaaaaa-0000-4000-8000-000000000001', null, 'improve_extraction', false, 'v1.0', 'in_app_itemised');
select public._t('withdrawing consent purges the student''s remaining signals',
  (select count(*) = 0 from learning.signal where student_id = 'aaaaaaaa-0000-4000-8000-000000000002'));

update public.mark_loss_event set student_rejected_at = null, student_confirmed_at = null
 where id = 'aaaaaaaa-0000-4000-8000-0000000000d2';
update public.mark_loss_event set student_confirmed_at = now() where id = 'aaaaaaaa-0000-4000-8000-0000000000d2';
select public._t('after withdrawal, nothing new is recorded',
  (select count(*) = 0 from learning.signal));

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method) values
 ('aaaaaaaa-0000-4000-8000-000000000001', null, 'improve_extraction', true, 'v1.0', 'in_app_itemised');
insert into learning.signal (student_id, attempt_id, kind, cause) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-0000000000c1','explanation_wrong','procedural_slip');
update public.student set deleted_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select public._t('soft-deleting a student purges their signals',
  (select count(*) = 0 from learning.signal where student_id = 'aaaaaaaa-0000-4000-8000-000000000002'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
