-- ============================================================================
-- Test suite: entitlements and billing gating
-- ============================================================================
-- UX_AND_MONETIZATION_THESIS.md: free is never a demo, and Pro gates
-- depth-over-time, server-side, never per-paper. This suite asserts both
-- halves of that from the database's point of view — not the client's.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/entitlements_and_billing.sql
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
-- Guardian A: Pro. Guardian B: free. One student each, so every assertion
-- below is about the tier line, not about ownership (that is already covered
-- by rls_and_hard_rules.sql).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111111','authenticated','authenticated','pro-parent@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','b2222222-2222-4222-8222-222222222222','authenticated','authenticated','free-parent@test.invalid','x',now(),now(),now());

insert into public.guardian
  (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref, subscription_status, subscription_renews_at) values
 ('a0000000-0000-4000-8000-000000000001','a1111111-1111-4111-8111-111111111111','Guardian Pro','a@test.invalid',now(),'stub','ref-a','pro',now() + interval '20 days'),
 ('b0000000-0000-4000-8000-000000000001','b2222222-2222-4222-8222-222222222222','Guardian Free','b@test.invalid',now(),'stub','ref-b','free',null);

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Priya',11,'under_18'),
 ('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','Bora',11,'under_18');

-- One recent paper (inside the free window) and one old paper (outside it) for
-- each student, in two subjects each, so a cross-subject pattern is possible.
insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000002','unit_test','tier_1', current_date - 10, 'Physics'),
 ('a0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000002','unit_test','tier_1', current_date - 5,  'Physics'),
 ('a0000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000002','unit_test','tier_1', current_date - 300,'Chemistry'),
 ('b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000002','unit_test','tier_1', current_date - 10, 'Physics'),
 ('b0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-000000000002','unit_test','tier_1', current_date - 5,  'Physics'),
 ('b0000000-0000-4000-8000-000000000012','b0000000-0000-4000-8000-000000000002','unit_test','tier_1', current_date - 300,'Chemistry');

insert into public.student_attempt (id, student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence) values
 ('a0000000-0000-4000-8000-000000000020','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000010','tier_1','Q1',3,5,'teacher_pen','confirmed'),
 ('a0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000012','tier_1','Q1',3,5,'teacher_pen','confirmed'),
 ('b0000000-0000-4000-8000-000000000020','b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000010','tier_1','Q1',3,5,'teacher_pen','confirmed'),
 ('b0000000-0000-4000-8000-000000000021','b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000012','tier_1','Q1',3,5,'teacher_pen','confirmed');

insert into public.mark_loss_event (id, attempt_id, student_id, cause, marks_lost, confidence, ai_explanation) values
 ('a0000000-0000-4000-8000-000000000030','a0000000-0000-4000-8000-000000000020','a0000000-0000-4000-8000-000000000002','procedural_slip',2,'confirmed','x'),
 ('a0000000-0000-4000-8000-000000000031','a0000000-0000-4000-8000-000000000021','a0000000-0000-4000-8000-000000000002','procedural_slip',2,'confirmed','x'),
 ('b0000000-0000-4000-8000-000000000030','b0000000-0000-4000-8000-000000000020','b0000000-0000-4000-8000-000000000002','procedural_slip',2,'confirmed','x'),
 ('b0000000-0000-4000-8000-000000000031','b0000000-0000-4000-8000-000000000021','b0000000-0000-4000-8000-000000000002','procedural_slip',2,'confirmed','x');

-- One single_subject and one cross_subject pattern_insight per student, as if
-- the patterns function had just run — inserted here as postgres (owner
-- bypasses RLS) since this suite is testing SELECT gating, not the insert path.
insert into public.pattern_insight (student_id, scope, cause, subjects, paper_ids, question_count, summary_text) values
 ('a0000000-0000-4000-8000-000000000002','single_subject','procedural_slip',array['Physics'],
   array['a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000011']::uuid[],2,
   'The same step is costing marks across your last 2 Physics papers.'),
 ('a0000000-0000-4000-8000-000000000002','cross_subject','procedural_slip',array['Physics','Chemistry'],
   array['a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000012']::uuid[],2,
   'The same step is costing marks in both Physics and Chemistry.'),
 ('b0000000-0000-4000-8000-000000000002','single_subject','procedural_slip',array['Physics'],
   array['b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000011']::uuid[],2,
   'The same step is costing marks across your last 2 Physics papers.'),
 ('b0000000-0000-4000-8000-000000000002','cross_subject','procedural_slip',array['Physics','Chemistry'],
   array['b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000012']::uuid[],2,
   'The same step is costing marks in both Physics and Chemistry.');

insert into public.parent_progress_report (student_id, period_start, period_end, summary_text) values
 ('a0000000-0000-4000-8000-000000000002', current_date - 90, current_date, 'Priya is improving fastest in Organic Chemistry.'),
 ('b0000000-0000-4000-8000-000000000002', current_date - 90, current_date, 'Bora is improving fastest in Mechanics.');

-- ══════════════════════════════════════════════════════════════════════════
-- get_entitlements(): the typed object itself
-- ══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('pro guardian: tier is pro',
  (select tier = 'pro' from public.get_entitlements()));
select public._t('pro guardian: every gated flag is on',
  (select cross_subject_patterns and full_historical_archive and parent_progress_reports and priority_processing
   from public.get_entitlements()));
select public._t('pro guardian: unlimited student profiles',
  (select max_student_profiles is null from public.get_entitlements()));

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';

select public._t('free guardian: tier is free',
  (select tier = 'free' from public.get_entitlements()));
select public._t('free guardian: every gated flag is off',
  (select not cross_subject_patterns and not full_historical_archive and not parent_progress_reports and not priority_processing
   from public.get_entitlements()));
select public._t('free guardian: exactly one student profile',
  (select max_student_profiles = 1 from public.get_entitlements()));

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- max_student_profiles: enforced where students are actually created
-- ══════════════════════════════════════════════════════════════════════════

do $$ begin
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
  begin
    insert into public.student (guardian_id, first_name, class_level, age_band)
    values ('b0000000-0000-4000-8000-000000000001','Second Kid',9,'under_18');
    perform public._t('free guardian cannot add a second student profile', false, 'insert succeeded');
  exception when others then
    perform public._t('free guardian cannot add a second student profile', true, sqlstate);
  end;
end $$;

do $$ begin
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
  begin
    insert into public.student (guardian_id, first_name, class_level, age_band)
    values ('a0000000-0000-4000-8000-000000000001','Second Kid',9,'under_18');
    perform public._t('pro guardian can add a second student profile', true);
  exception when others then
    perform public._t('pro guardian can add a second student profile', false, sqlstate);
  end;
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- full_historical_archive: paper listing never gated, per-question depth is
-- ══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';

select public._t('free guardian: the old paper still appears in the library (count/date only)',
  (select count(*) = 1 from public.paper where id = 'b0000000-0000-4000-8000-000000000012'));
select public._t('free guardian: recent-paper depth is fully readable',
  (select count(*) = 1 from public.student_attempt where id = 'b0000000-0000-4000-8000-000000000020'));
select public._t('free guardian: old-paper attempt depth is NOT readable',
  (select count(*) = 0 from public.student_attempt where id = 'b0000000-0000-4000-8000-000000000021'));
select public._t('free guardian: old-paper loss-event depth is NOT readable',
  (select count(*) = 0 from public.mark_loss_event where id = 'b0000000-0000-4000-8000-000000000031'));
select public._t('free guardian: NOTHING is gated on the recent paper -- this is never a demo',
  (select count(*) = 1 from public.mark_loss_event where id = 'b0000000-0000-4000-8000-000000000030'));

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('pro guardian: old-paper attempt depth IS readable',
  (select count(*) = 1 from public.student_attempt where id = 'a0000000-0000-4000-8000-000000000021'));
select public._t('pro guardian: old-paper loss-event depth IS readable',
  (select count(*) = 1 from public.mark_loss_event where id = 'a0000000-0000-4000-8000-000000000031'));

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- cross_subject_patterns: the single most important gate in the schema
-- ══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';

select public._t('free guardian: single-subject insight is fully visible, identical to Pro',
  (select count(*) = 1 from public.pattern_insight
   where student_id = 'b0000000-0000-4000-8000-000000000002' and scope = 'single_subject'));
select public._t('free guardian: cross-subject row is invisible from Postgres itself, not just the UI',
  (select count(*) = 0 from public.pattern_insight
   where student_id = 'b0000000-0000-4000-8000-000000000002' and scope = 'cross_subject'));
select public._t('free guardian: the existence-only teaser signal IS visible (the honest, true teaser)',
  (select count(*) = 1 from public.get_cross_subject_signal() where student_id = 'b0000000-0000-4000-8000-000000000002'));
select public._t('free guardian: parent progress report is NOT visible',
  (select count(*) = 0 from public.parent_progress_report where student_id = 'b0000000-0000-4000-8000-000000000002'));

do $$ begin begin
  insert into public.pattern_insight (student_id, scope, cause, subjects, paper_ids, question_count, summary_text)
  values ('a0000000-0000-4000-8000-000000000002','single_subject','timed_out',array['Physics'],
          array['a0000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000011']::uuid[],2,'x');
  perform public._t('free guardian cannot write a pattern for someone else''s student', false, 'insert succeeded');
exception when others then
  perform public._t('free guardian cannot write a pattern for someone else''s student', true, sqlstate);
end; end $$;

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('pro guardian: cross-subject row IS visible, with its full specifics',
  (select subjects = array['Physics','Chemistry'] from public.pattern_insight
   where student_id = 'a0000000-0000-4000-8000-000000000002' and scope = 'cross_subject'));
select public._t('pro guardian: parent progress report IS visible',
  (select count(*) = 1 from public.parent_progress_report where student_id = 'a0000000-0000-4000-8000-000000000002'));
select public._t('pro guardian cannot see the free guardian''s patterns at all',
  (select count(*) = 0 from public.pattern_insight where student_id = 'b0000000-0000-4000-8000-000000000002'));

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- past_due: a failed payment ends Pro immediately, with no grace window
-- ══════════════════════════════════════════════════════════════════════════
-- Guardian A is Pro and, by this point in the suite, has two student profiles.

update public.guardian set subscription_status = 'past_due'
  where id = 'a0000000-0000-4000-8000-000000000001';

select public._t('past_due resolves to free the moment it is written',
  not private.guardian_is_pro('a0000000-0000-4000-8000-000000000001'));

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('past_due guardian: tier is free',
  (select tier = 'free' from public.get_entitlements()));
select public._t('past_due guardian: the downgrade is explained, not silent',
  (select billing_state = 'past_due' from public.get_entitlements()));
select public._t('past_due guardian: cross-subject rows are gone at once',
  (select count(*) = 0 from public.pattern_insight
   where student_id = 'a0000000-0000-4000-8000-000000000002' and scope = 'cross_subject'));
select public._t('past_due guardian: the parent progress report is gone at once',
  (select count(*) = 0 from public.parent_progress_report
   where student_id = 'a0000000-0000-4000-8000-000000000002'));
select public._t('past_due guardian: depth on an OLD paper is gone at once',
  (select count(*) = 0 from public.student_attempt
   where id = 'a0000000-0000-4000-8000-000000000021'));

-- The half that must NOT change. Losing Pro is losing depth-over-time; it is
-- never a demotion of the student's own scan -> understand -> act loop.
select public._t('past_due guardian: the recent paper keeps full depth',
  (select count(*) = 1 from public.student_attempt
   where id = 'a0000000-0000-4000-8000-000000000020'));
select public._t('past_due guardian: the recent paper''s explanation is untouched',
  (select count(*) = 1 from public.mark_loss_event
   where id = 'a0000000-0000-4000-8000-000000000030'));
select public._t('past_due guardian: the old paper still lists in the library',
  (select count(*) = 1 from public.paper
   where id = 'a0000000-0000-4000-8000-000000000012'));
select public._t('past_due guardian: the free single-subject insight still shows',
  (select count(*) = 1 from public.pattern_insight
   where student_id = 'a0000000-0000-4000-8000-000000000002' and scope = 'single_subject'));
select public._t('past_due guardian: the existence-only teaser still shows',
  (select count(*) = 1 from public.get_cross_subject_signal()));
select public._t('past_due guardian: both children they already added are kept',
  (select count(*) = 2 from public.student
   where guardian_id = 'a0000000-0000-4000-8000-000000000001'));

reset role;

-- A successful Stripe retry writes status back to pro through the same path,
-- and everything returns with it. Nothing is deferred in either direction.
update public.guardian set subscription_status = 'pro'
  where id = 'a0000000-0000-4000-8000-000000000001';
select public._t('a successful retry restores Pro immediately',
  private.guardian_is_pro('a0000000-0000-4000-8000-000000000001'));

-- ══════════════════════════════════════════════════════════════════════════
-- stripe_event: nothing but the webhook handler (service_role) may touch it
-- ══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('authenticated reads no stripe events',
  (select count(*) = 0 from public.stripe_event));

do $$ begin begin
  insert into public.stripe_event (id, type) values ('evt_forged', 'checkout.session.completed');
  perform public._t('authenticated cannot write a stripe event', false, 'insert succeeded');
exception when others then
  perform public._t('authenticated cannot write a stripe event', true, sqlstate);
end; end $$;

reset role;

-- ── anon: reaches none of this ──────────────────────────────────────────────

set local role anon;
set local "request.jwt.claims" = '';

select public._t('anon reads no entitlements-relevant tables',
  (select count(*) = 0 from public.pattern_insight)
  and (select count(*) = 0 from public.parent_progress_report)
  and (select count(*) = 0 from public.stripe_event));

reset role;

-- ══════════════════════════════════════════════════════════════════════════
select count(*) as total, count(*) filter (where passed) as passed, count(*) filter (where not passed) as failed from public._r;
select * from public._r where not passed order by seq;
rollback;
