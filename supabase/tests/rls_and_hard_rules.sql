-- ============================================================================
-- Test suite: RLS isolation + CLAUDE.md's four hard rules
-- ============================================================================
-- Runs inside a transaction that ROLLS BACK, so it leaves nothing behind and is
-- safe against any database including production.
--
-- Impersonation matches what PostgREST does: SET LOCAL ROLE plus a
-- request.jwt.claims JSON carrying `sub`, which is what auth.uid() reads.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/rls_and_hard_rules.sql
--   Pass: final SELECT reports failed = 0.
--
-- The hard-rule assertions deliberately run as the privileged role, because a
-- rule enforced only by RLS is not enforced against the service role — and the
-- extraction pipeline runs as the service role.
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
 ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','gb@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','gc@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a'),
 ('bbbbbbbb-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Guardian B','b@test.invalid',now(),'stub','ref-b');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18'),
 ('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000001','Bora',12,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken) values
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01'),
 ('aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000002','pyq','tier_2','2026-07-01'),
 ('bbbbbbbb-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02');

insert into public.chapter (id, class_level, subject, name)
 values ('dddddddd-0000-4000-8000-000000000001',11,'Physics','Rotational Motion');
insert into public.concept (id, chapter_id, name)
 values ('eeeeeeee-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','Torque');
insert into public.canonical_question (id, exam_year, subject, question_text, max_marks, marking_scheme, scheme_source, scheme_version)
 values ('cccccccc-0000-4000-8000-000000000001',2023,'Physics','Derive the moment of inertia...',5,
         '1 mark for stating assumptions before the derivation','CBSE 2023 marking scheme','v1');

insert into public.student_attempt (id, student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence) values
 ('aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','tier_1','Q1',3,5,'teacher_pen','confirmed'),
 ('bbbbbbbb-0000-4000-8000-000000000004','bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000003','tier_1','Q1',4,5,'teacher_pen','confirmed');

insert into public.mark_loss_event (id, attempt_id, student_id, cause, marks_lost, confidence, ai_explanation) values
 ('aaaaaaaa-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000002','presentation',2,'likely','Your answer is right. The mark went for units.'),
 ('bbbbbbbb-0000-4000-8000-000000000005','bbbbbbbb-0000-4000-8000-000000000004','bbbbbbbb-0000-4000-8000-000000000002','keyword_miss',1,'likely','x');

-- Objects for both students, written as the privileged role so the isolation
-- tests below have something real to fail to reach.
insert into storage.objects (bucket_id, name, owner) values
 ('papers','aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-000000000003/1.jpg','11111111-1111-4111-8111-111111111111'),
 ('papers','bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000003/1.jpg','22222222-2222-4222-8222-222222222222');

-- ══════════════════════════════════════════════════════════════════════════
-- Hard rule 1 · the model never assigns marks
-- ══════════════════════════════════════════════════════════════════════════
-- marks_source is NOT NULL and can only name a human origin, so a mark with no
-- human provenance cannot be stored at all.

do $$ begin begin
  insert into public.student_attempt (student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, extraction_confidence)
  values ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','tier_1','Q7',2,5,'confirmed');
  perform public._t('rule1: a mark with no human source cannot exist', false, 'insert succeeded');
exception when others then perform public._t('rule1: a mark with no human source cannot exist', true, sqlstate); end; end $$;

do $$ begin begin
  insert into public.student_attempt (student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence)
  values ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','tier_1','Q8',7,5,'teacher_pen','confirmed');
  perform public._t('rule1: marks_awarded cannot exceed max_marks', false, 'insert succeeded');
exception when others then perform public._t('rule1: marks_awarded cannot exceed max_marks', true, sqlstate); end; end $$;

do $$ begin begin
  insert into public.mark_loss_event (attempt_id, student_id, cause, marks_lost, confidence)
  values ('aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000002','incomplete',3,'likely');
  perform public._t('marks_lost total cannot exceed marks forgone', false, 'insert succeeded');
exception when others then perform public._t('marks_lost total cannot exceed marks forgone', true, sqlstate); end; end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Hard rule 2 · never fabricate a marking scheme
-- ══════════════════════════════════════════════════════════════════════════

do $$ begin begin
  insert into public.student_attempt (student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence, canonical_question_id)
  values ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','tier_1','Q9',1,5,'teacher_pen','confirmed','cccccccc-0000-4000-8000-000000000001');
  perform public._t('rule2: a tier_1 attempt cannot cite a scheme', false, 'insert succeeded');
exception when others then perform public._t('rule2: a tier_1 attempt cannot cite a scheme', true, sqlstate); end; end $$;

do $$ begin begin
  insert into public.paper (student_id, type, tier, date_taken)
  values ('aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_2','2026-08-03');
  perform public._t('rule2: a school test cannot be tier_2', false, 'insert succeeded');
exception when others then perform public._t('rule2: a school test cannot be tier_2', true, sqlstate); end; end $$;

do $$ begin begin
  insert into public.canonical_question (exam_year, subject, question_text, max_marks, marking_scheme)
  values (2023,'Physics','q',5,'a reconstructed scheme');
  perform public._t('rule2: scheme text without source and version is refused', false, 'insert succeeded');
exception when others then perform public._t('rule2: scheme text without source and version is refused', true, sqlstate); end; end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Hard rule 3 · unsure data never reaches analytics
-- ══════════════════════════════════════════════════════════════════════════

insert into public.student_attempt (id, student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence)
values ('aaaaaaaa-0000-4000-8000-000000000006','aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','tier_1','Q2',1,5,'teacher_pen','unsure');

select public._t('rule3: an unsure attempt is excluded from analytics but still stored',
  (select count(*) = 0 from public.attempt_analytics where id='aaaaaaaa-0000-4000-8000-000000000006')
  and (select count(*) = 1 from public.student_attempt where id='aaaaaaaa-0000-4000-8000-000000000006'));

update public.student_attempt set student_confirmed_at = now() where id='aaaaaaaa-0000-4000-8000-000000000006';
select public._t('rule3: confirming an unsure attempt admits it to analytics',
  (select count(*) = 1 from public.attempt_analytics where id='aaaaaaaa-0000-4000-8000-000000000006'));

insert into public.mark_loss_event (id, attempt_id, student_id, cause, marks_lost, confidence)
values ('aaaaaaaa-0000-4000-8000-000000000007','aaaaaaaa-0000-4000-8000-000000000006','aaaaaaaa-0000-4000-8000-000000000002','timed_out',2,'unsure');
select public._t('rule3: an unsure loss event is excluded from analytics',
  (select count(*) = 0 from public.mark_loss_analytics where id='aaaaaaaa-0000-4000-8000-000000000007'));

-- "Not why I lost it" — accepted immediately, and it leaves aggregation.
update public.mark_loss_event set student_rejected_at = now() where id='aaaaaaaa-0000-4000-8000-000000000005';
select public._t('a cause the student rejected leaves analytics',
  (select count(*) = 0 from public.mark_loss_analytics where id='aaaaaaaa-0000-4000-8000-000000000005'));

select public._t('readiness view reports an honest sample size',
  (select papers_counted = 1 and has_enough_data = false
   from public.student_analytics_readiness where student_id='aaaaaaaa-0000-4000-8000-000000000002'));

do $$ begin begin
  insert into public.mark_loss_event (attempt_id, student_id, cause, marks_lost, confidence, student_confirmed_at, student_rejected_at)
  values ('aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000002','incomplete',0.5,'likely',now(),now());
  perform public._t('a loss event cannot be both confirmed and rejected', false, 'insert succeeded');
exception when others then perform public._t('a loss event cannot be both confirmed and rejected', true, sqlstate); end; end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Consent ledger: append-only at the privileged layer
-- ══════════════════════════════════════════════════════════════════════════
-- This is the layer the trigger exists for. RLS does not constrain the service
-- role, so without it a server-side bug could rewrite the compliance evidence.

do $$ begin begin
  update public.consent_event set granted = false where guardian_id='aaaaaaaa-0000-4000-8000-000000000001';
  perform public._t('privileged UPDATE of consent_event is refused', false, 'update succeeded');
exception when others then perform public._t('privileged UPDATE of consent_event is refused', true, sqlstate); end; end $$;

do $$ begin begin
  delete from public.consent_event where guardian_id='aaaaaaaa-0000-4000-8000-000000000001';
  perform public._t('privileged DELETE of consent_event is refused', false, 'delete succeeded');
exception when others then perform public._t('privileged DELETE of consent_event is refused', true, sqlstate); end; end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Consent gates and ordering
-- ══════════════════════════════════════════════════════════════════════════

insert into public.guardian (id, auth_user_id, name, contact)
values ('cccccccc-0000-4000-8000-000000000009','33333333-3333-4333-8333-333333333333','Guardian C','c@test.invalid');

do $$ begin begin
  insert into public.student (guardian_id, first_name, class_level, age_band)
  values ('cccccccc-0000-4000-8000-000000000009','Chandra',9,'under_18');
  perform public._t('gate: student data blocked without consent', false, 'insert succeeded');
exception when others then perform public._t('gate: student data blocked without consent', true, sqlstate); end; end $$;

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('cccccccc-0000-4000-8000-000000000009',null,'store_papers',true,'v1.0','in_app_itemised');

do $$ begin begin
  insert into public.student (guardian_id, first_name, class_level, age_band)
  values ('cccccccc-0000-4000-8000-000000000009','Chandra',9,'under_18');
  perform public._t('gate: student data blocked on partial consent', false, 'insert succeeded');
exception when others then perform public._t('gate: student data blocked on partial consent', true, sqlstate); end; end $$;

-- Ordering regression: every row below shares one transaction timestamp, so a
-- created_at-ordered implementation resolves "latest" by random uuid and fails.
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','store_papers',false,'v1.0','in_app_withdrawal');

select public._t('ordering: withdrawal wins over an earlier grant in the same transaction',
  private.consent_is_granted('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','store_papers') = false);

do $$ begin begin
  insert into public.paper (student_id, type, tier, date_taken)
  values ('aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-04');
  perform public._t('gate: paper write blocked after withdrawal', false, 'insert succeeded');
exception when others then perform public._t('gate: paper write blocked after withdrawal', true, sqlstate); end; end $$;

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('aaaaaaaa-0000-4000-8000-000000000001',null,'store_papers',true,'v1.0','in_app_itemised');
select public._t('scope: a guardian-scope grant does not override a student withdrawal',
  private.consent_is_granted('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','store_papers') = false);

select public._t('optional purposes default to off',
  private.consent_is_granted('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','weekly_parent_digest') = false);

-- ══════════════════════════════════════════════════════════════════════════
-- RLS: guardian A
-- ══════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('A sees only its own guardian row', (select count(*) = 1 from public.guardian));
select public._t('A sees only its own student',      (select count(*) = 1 from public.student));
select public._t('A cannot read B''s papers',        (select count(*) = 0 from public.paper where student_id='bbbbbbbb-0000-4000-8000-000000000002'));
select public._t('A cannot read B''s attempts',      (select count(*) = 0 from public.student_attempt where student_id='bbbbbbbb-0000-4000-8000-000000000002'));
select public._t('A cannot read B''s loss events',   (select count(*) = 0 from public.mark_loss_event where student_id='bbbbbbbb-0000-4000-8000-000000000002'));
select public._t('A cannot read B''s consent',       (select count(*) = 0 from public.consent_event where guardian_id='bbbbbbbb-0000-4000-8000-000000000001'));

-- The analytics views must not become a hole around RLS. This is what
-- security_invoker buys, and it is worth asserting rather than assuming.
select public._t('analytics views are RLS-scoped too',
  (select count(*) = 0 from public.mark_loss_analytics where student_id='bbbbbbbb-0000-4000-8000-000000000002'));
select public._t('consent_current view is RLS-scoped too',
  (select count(*) = 0 from public.consent_current where guardian_id='bbbbbbbb-0000-4000-8000-000000000001'));

do $$ declare n int; begin
  update public.student set first_name='hacked' where id='bbbbbbbb-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform public._t('A''s UPDATE of B''s student affects no rows', n = 0, 'rows=' || n);
end $$;

do $$ declare n int; begin
  update public.mark_loss_event set ai_explanation='x' where student_id='bbbbbbbb-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform public._t('A''s UPDATE of B''s loss event affects no rows', n = 0, 'rows=' || n);
end $$;

-- For a client, RLS filters the rows away and the statement affects nothing
-- without raising; the trigger only fires where a row qualifies.
do $$ declare n int; begin
  update public.consent_event set granted=false where guardian_id='aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform public._t('client UPDATE of consent_event affects no rows', n = 0, 'rows=' || n);
exception when others then
  perform public._t('client UPDATE of consent_event affects no rows', false, 'raised ' || sqlstate);
end $$;

do $$ begin begin
  insert into public.student (guardian_id, first_name, class_level, age_band)
  values ('bbbbbbbb-0000-4000-8000-000000000001','Injected',10,'under_18');
  perform public._t('A cannot create a student under guardian B', false, 'insert succeeded');
exception when others then perform public._t('A cannot create a student under guardian B', true, sqlstate); end; end $$;

do $$ begin begin
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('bbbbbbbb-0000-4000-8000-000000000001',null,'store_papers',false,'v1.0','in_app_withdrawal');
  perform public._t('A cannot forge consent as guardian B', false, 'insert succeeded');
exception when others then perform public._t('A cannot forge consent as guardian B', true, sqlstate); end; end $$;

do $$ begin begin
  insert into public.student_attempt (student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence)
  values ('aaaaaaaa-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000003','tier_1','Q1',1,5,'teacher_pen','confirmed');
  perform public._t('an attempt cannot use another student''s paper', false, 'insert succeeded');
exception when others then perform public._t('an attempt cannot use another student''s paper', true, sqlstate); end; end $$;

-- ── storage: the papers bucket ─────────────────────────────────────────────
-- Uploads are images of a child's handwriting. The path convention is
-- papers/<student_id>/..., and it is enforced by policy, not by the client
-- choosing to behave. Insert is additionally gated on live store_papers
-- consent, so a withdrawal stops new uploads rather than only hiding old ones.

select public._t('the papers bucket is private',
  (select not public from storage.buckets where id = 'papers'));

do $$ declare n int; begin
  select count(*) into n from storage.objects
  where bucket_id = 'papers' and name like 'bbbbbbbb-0000-4000-8000-000000000002/%';
  perform public._t('A cannot list objects under B''s student prefix', n = 0, 'rows=' || n);
end $$;

do $$ begin begin
  insert into storage.objects (bucket_id, name, owner)
  values ('papers', 'bbbbbbbb-0000-4000-8000-000000000002/p/1.jpg',
          '11111111-1111-4111-8111-111111111111');
  perform public._t('A cannot upload into B''s student prefix', false, 'insert succeeded');
exception when others then perform public._t('A cannot upload into B''s student prefix', true, sqlstate); end; end $$;

-- A's own prefix, but store_papers was withdrawn for that student above.
do $$ begin begin
  insert into storage.objects (bucket_id, name, owner)
  values ('papers', 'aaaaaaaa-0000-4000-8000-000000000002/p/1.jpg',
          '11111111-1111-4111-8111-111111111111');
  perform public._t('upload is refused after store_papers is withdrawn', false, 'insert succeeded');
exception when others then perform public._t('upload is refused after store_papers is withdrawn', true, sqlstate); end; end $$;

-- shared reference data: readable, not writable
select public._t('A can read canonical_question', (select count(*) = 1 from public.canonical_question));

do $$ begin begin
  insert into public.canonical_question (exam_year, subject, question_text, max_marks) values (2024,'Physics','q',5);
  perform public._t('A cannot write canonical_question', false, 'insert succeeded');
exception when others then perform public._t('A cannot write canonical_question', true, sqlstate); end; end $$;

do $$ begin begin
  insert into public.chapter (class_level, subject, name) values (11,'Physics','Injected');
  perform public._t('A cannot write chapter', false, 'insert succeeded');
exception when others then perform public._t('A cannot write chapter', true, sqlstate); end; end $$;

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- RLS: guardian B — the mirror, so neither result is a fluke
-- ══════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select public._t('B sees only its own student',
  (select count(*) = 1 from public.student)
  and (select count(*) = 0 from public.student where id='aaaaaaaa-0000-4000-8000-000000000002'));
select public._t('B cannot read A''s attempts',
  (select count(*) = 0 from public.student_attempt where student_id='aaaaaaaa-0000-4000-8000-000000000002'));
select public._t('B sees only its own paper objects',
  (select count(*) = 1 from storage.objects where bucket_id = 'papers')
  and (select count(*) = 0 from storage.objects
       where name like 'aaaaaaaa-0000-4000-8000-000000000002/%'));

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- RLS: anon — the publishable key must reach nothing
-- ══════════════════════════════════════════════════════════════════════════
set local role anon;
set local "request.jwt.claims" = '';

select public._t('anon reads no guardians',   (select count(*) = 0 from public.guardian));
select public._t('anon reads no students',    (select count(*) = 0 from public.student));
select public._t('anon reads no papers',      (select count(*) = 0 from public.paper));
select public._t('anon reads no attempts',    (select count(*) = 0 from public.student_attempt));
select public._t('anon reads no loss events', (select count(*) = 0 from public.mark_loss_event));
select public._t('anon reads no consent',     (select count(*) = 0 from public.consent_event));
select public._t('anon reads no analytics',   (select count(*) = 0 from public.attempt_analytics));
-- The publishable key ships in the client. It must not enumerate a single page
-- of a single child's exam paper.
select public._t('anon reads no paper objects',
  (select count(*) = 0 from storage.objects where bucket_id = 'papers'));
-- Even the shared question bank is authenticated-only: it is licensed scheme
-- paraphrase, and there is no reason for an unauthenticated key to enumerate it.
select public._t('anon cannot read canonical_question', (select count(*) = 0 from public.canonical_question));

reset role;

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
