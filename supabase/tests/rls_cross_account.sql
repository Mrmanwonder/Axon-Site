-- ============================================================================
-- RLS cross-account test suite
-- ============================================================================
-- Asserts that guardian A can never reach guardian B's student, papers,
-- attempts, loss events or consent record — and that the consent ledger cannot
-- be rewritten and the consent gates actually bite.
--
-- Runs entirely inside a transaction that ROLLS BACK, so it leaves no rows
-- behind and is safe against any database including production.
--
-- Impersonation is done the way PostgREST does it: SET LOCAL ROLE authenticated
-- plus a request.jwt.claims JSON carrying `sub`, which is what auth.uid() reads.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/rls_cross_account.sql
--   Pass: final SELECT reports zero rows with passed = false.
-- ============================================================================

begin;

-- ── result collector ───────────────────────────────────────────────────────
-- A real table rather than a temp table so the impersonated role can write to
-- it without needing grants on a temp schema. Rolled back with everything else.

create table public._rls_test_results (
  seq     serial primary key,
  name    text    not null,
  passed  boolean not null,
  detail  text
);
grant all on public._rls_test_results to authenticated, anon;
grant usage, select on sequence public._rls_test_results_seq_seq to authenticated, anon;

create or replace function public._t(p_name text, p_passed boolean, p_detail text default null)
returns void language sql as $$
  insert into public._rls_test_results (name, passed, detail) values (p_name, p_passed, p_detail);
$$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- ── fixtures (privileged: bypasses RLS, but triggers still fire) ───────────

\set uid_a '11111111-1111-4111-8111-111111111111'
\set uid_b '22222222-2222-4222-8222-222222222222'

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', :'uid_a', 'authenticated', 'authenticated',
   'guardian-a@test.invalid', 'x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', :'uid_b', 'authenticated', 'authenticated',
   'guardian-b@test.invalid', 'x', now(), now(), now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at,
                             verification_method, verification_ref)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', :'uid_a', 'Guardian A', 'a@test.invalid',
   now(), 'stub', 'stub-ref-a'),
  ('bbbbbbbb-0000-4000-8000-000000000001', :'uid_b', 'Guardian B', 'b@test.invalid',
   now(), 'stub', 'stub-ref-b');

-- Required consent for both guardians, so student creation is permitted.
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g
cross join public.consent_purpose cp
where cp.is_required;

insert into public.student (id, guardian_id, first_name, board, class_level, age_band)
values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Anya', 'CBSE', 11, 'under_18'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001',
   'Bora', 'CBSE', 12, 'under_18');

insert into public.paper (id, student_id) values
  ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000002'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002');

insert into public.attempt (id, student_id, paper_id) values
  ('aaaaaaaa-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000003'),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000002',
   'bbbbbbbb-0000-4000-8000-000000000003');

insert into public.loss_event (id, student_id, attempt_id) values
  ('aaaaaaaa-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000004'),
  ('bbbbbbbb-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000002',
   'bbbbbbbb-0000-4000-8000-000000000004');

insert into public.canonical_question (id) values ('cccccccc-0000-4000-8000-000000000001');

-- ══════════════════════════════════════════════════════════════════════════
-- Session: GUARDIAN A
-- ══════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- reads are scoped to self
select public._t('A sees exactly its own guardian row',
  (select count(*) = 1 from public.guardian where auth_user_id = '11111111-1111-4111-8111-111111111111'::uuid)
  and (select count(*) = 1 from public.guardian));

select public._t('A cannot read guardian B',
  (select count(*) = 0 from public.guardian where id = 'bbbbbbbb-0000-4000-8000-000000000001'));

select public._t('A sees only its own student',
  (select count(*) = 1 from public.student)
  and (select count(*) = 0 from public.student where id = 'bbbbbbbb-0000-4000-8000-000000000002'));

select public._t('A cannot read B''s papers',
  (select count(*) = 1 from public.paper)
  and (select count(*) = 0 from public.paper where id = 'bbbbbbbb-0000-4000-8000-000000000003'));

select public._t('A cannot read B''s attempts',
  (select count(*) = 1 from public.attempt)
  and (select count(*) = 0 from public.attempt where id = 'bbbbbbbb-0000-4000-8000-000000000004'));

select public._t('A cannot read B''s loss events',
  (select count(*) = 1 from public.loss_event)
  and (select count(*) = 0 from public.loss_event where id = 'bbbbbbbb-0000-4000-8000-000000000005'));

select public._t('A cannot read B''s consent events',
  (select count(*) = 0 from public.consent_event
   where guardian_id = 'bbbbbbbb-0000-4000-8000-000000000001'));

-- Silent-no-op writes. RLS does not raise on these: it filters the target rows
-- away, so the statement succeeds having changed nothing. That distinction
-- matters — a policy that merely hides rows still passes a "did it error?" test
-- while leaking nothing, so these assert the row count directly.
do $$ declare n int; begin
  update public.guardian set name = 'hacked' where id = 'bbbbbbbb-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform public._t('A''s UPDATE of guardian B affects no rows', n = 0, 'rows=' || n);
end $$;

do $$ declare n int; begin
  update public.student set first_name = 'hacked' where id = 'bbbbbbbb-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform public._t('A''s UPDATE of B''s student affects no rows', n = 0, 'rows=' || n);
end $$;

do $$ declare n int; begin
  delete from public.paper where id = 'bbbbbbbb-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  perform public._t('A''s DELETE of B''s paper affects no rows', n = 0, 'rows=' || n);
end $$;

do $$ declare n int; begin
  update public.loss_event set created_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000005';
  get diagnostics n = row_count;
  perform public._t('A''s UPDATE of B''s loss event affects no rows', n = 0, 'rows=' || n);
end $$;

-- rejected writes: WITH CHECK / triggers must raise
do $$ begin
  begin
    insert into public.student (guardian_id, first_name, board, class_level, age_band)
    values ('bbbbbbbb-0000-4000-8000-000000000001', 'Injected', 'CBSE', 10, 'under_18');
    perform public._t('A cannot create a student under guardian B', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('A cannot create a student under guardian B', true, sqlstate);
  end;
end $$;

do $$ begin
  begin
    insert into public.paper (student_id) values ('bbbbbbbb-0000-4000-8000-000000000002');
    perform public._t('A cannot create a paper for B''s student', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('A cannot create a paper for B''s student', true, sqlstate);
  end;
end $$;

do $$ begin
  begin
    insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
    values ('bbbbbbbb-0000-4000-8000-000000000001', null, 'store_papers', false, 'v1.0', 'in_app_withdrawal');
    perform public._t('A cannot forge consent as guardian B', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('A cannot forge consent as guardian B', true, sqlstate);
  end;
end $$;

-- Append-only, layer 1: the client.
-- There is no UPDATE or DELETE policy on consent_event, so RLS filters every
-- row away and the statement affects nothing. Note it does NOT raise — the
-- row-level trigger never fires because no row qualifies. Asserting an
-- exception here would be asserting the wrong mechanism; what matters is that
-- no row changed.
do $$ declare n int; begin
  update public.consent_event set granted = false
  where guardian_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform public._t('client UPDATE of consent_event affects no rows', n = 0, 'rows=' || n);
end $$;

do $$ declare n int; begin
  delete from public.consent_event where guardian_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform public._t('client DELETE of consent_event affects no rows', n = 0, 'rows=' || n);
end $$;

-- canonical_question: readable, not writable
select public._t('A can read canonical_question',
  (select count(*) = 1 from public.canonical_question));

do $$ begin
  begin
    insert into public.canonical_question (id) values (gen_random_uuid());
    perform public._t('A cannot write canonical_question', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('A cannot write canonical_question', true, sqlstate);
  end;
end $$;

-- cross-student integrity: composite FK must refuse a foreign parent
do $$ begin
  begin
    insert into public.attempt (student_id, paper_id)
    values ('aaaaaaaa-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000003');
    perform public._t('attempt cannot reference another student''s paper', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('attempt cannot reference another student''s paper', true, sqlstate);
  end;
end $$;

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- Session: GUARDIAN B — the mirror image, so neither result is a fluke
-- ══════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select public._t('B sees only its own student',
  (select count(*) = 1 from public.student)
  and (select count(*) = 0 from public.student where id = 'aaaaaaaa-0000-4000-8000-000000000002'));

select public._t('B cannot read A''s papers',
  (select count(*) = 0 from public.paper where id = 'aaaaaaaa-0000-4000-8000-000000000003'));

select public._t('B cannot read A''s loss events',
  (select count(*) = 0 from public.loss_event where id = 'aaaaaaaa-0000-4000-8000-000000000005'));

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- Session: ANON — the publishable key must reach nothing
-- ══════════════════════════════════════════════════════════════════════════
set local role anon;
set local "request.jwt.claims" = '';

select public._t('anon reads no guardians',      (select count(*) = 0 from public.guardian));
select public._t('anon reads no students',       (select count(*) = 0 from public.student));
select public._t('anon reads no papers',         (select count(*) = 0 from public.paper));
select public._t('anon reads no attempts',       (select count(*) = 0 from public.attempt));
select public._t('anon reads no loss events',    (select count(*) = 0 from public.loss_event));
select public._t('anon reads no consent events', (select count(*) = 0 from public.consent_event));

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- Append-only, layer 2: the privileged role.
-- ══════════════════════════════════════════════════════════════════════════
-- This is the layer the trigger exists for. RLS does not constrain the service
-- role or the table owner, so without the trigger a server-side bug or a
-- careless console query could rewrite the compliance evidence. Here rows DO
-- qualify, the trigger fires, and the statement must fail.

do $$ begin
  begin
    update public.consent_event set granted = false
    where guardian_id = 'aaaaaaaa-0000-4000-8000-000000000001';
    perform public._t('privileged UPDATE of consent_event is refused', false, 'update unexpectedly succeeded');
  exception when others then
    perform public._t('privileged UPDATE of consent_event is refused', true, sqlstate);
  end;
end $$;

do $$ begin
  begin
    delete from public.consent_event where guardian_id = 'aaaaaaaa-0000-4000-8000-000000000001';
    perform public._t('privileged DELETE of consent_event is refused', false, 'delete unexpectedly succeeded');
  exception when others then
    perform public._t('privileged DELETE of consent_event is refused', true, sqlstate);
  end;
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Consent gates (privileged role: proves the gate is in the database, not
-- merely in RLS — a service-role bug must not be able to bypass it either)
-- ══════════════════════════════════════════════════════════════════════════

-- A guardian with no consent at all cannot have a student created.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
        'authenticated', 'authenticated', 'guardian-c@test.invalid', 'x', now(), now(), now());

insert into public.guardian (id, auth_user_id, name, contact)
values ('cccccccc-0000-4000-8000-000000000009', '33333333-3333-4333-8333-333333333333',
        'Guardian C', 'c@test.invalid');

do $$ begin
  begin
    insert into public.student (guardian_id, first_name, board, class_level, age_band)
    values ('cccccccc-0000-4000-8000-000000000009', 'Chandra', 'CBSE', 9, 'under_18');
    perform public._t('student write blocked without consent', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('student write blocked without consent', true, sqlstate);
  end;
end $$;

-- Partial consent is still insufficient: one required purpose missing.
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('cccccccc-0000-4000-8000-000000000009', null, 'store_papers', true, 'v1.0', 'in_app_itemised');

do $$ begin
  begin
    insert into public.student (guardian_id, first_name, board, class_level, age_band)
    values ('cccccccc-0000-4000-8000-000000000009', 'Chandra', 'CBSE', 9, 'under_18');
    perform public._t('student write blocked on partial consent', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('student write blocked on partial consent', true, sqlstate);
  end;
end $$;

-- ── ordering and scope precedence ──────────────────────────────────────────
-- Regression cover for a bug this suite caught: ordering the ledger by
-- created_at is wrong, because now() is the transaction timestamp and every row
-- written in one transaction shares it exactly — leaving a random uuid to decide
-- which decision was "latest". These assertions all run inside a single
-- transaction precisely so that a timestamp-ordered implementation fails them.

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
        'store_papers', false, 'v1.0', 'in_app_withdrawal');

select public._t('withdrawal wins over earlier grant in the same transaction',
  public.consent_is_granted('aaaaaaaa-0000-4000-8000-000000000001',
                            'aaaaaaaa-0000-4000-8000-000000000002', 'store_papers') = false);

-- Withdrawal stops new writes rather than merely hiding old rows.
do $$ begin
  begin
    insert into public.paper (student_id) values ('aaaaaaaa-0000-4000-8000-000000000002');
    perform public._t('paper write blocked after withdrawal', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('paper write blocked after withdrawal', true, sqlstate);
  end;
end $$;

-- A guardian-scope grant must not silently reinstate a student-scoped
-- withdrawal: the more specific scope wins regardless of recency.
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('aaaaaaaa-0000-4000-8000-000000000001', null, 'store_papers', true, 'v1.0', 'in_app_itemised');

select public._t('guardian-scope grant does not override a student withdrawal',
  public.consent_is_granted('aaaaaaaa-0000-4000-8000-000000000001',
                            'aaaaaaaa-0000-4000-8000-000000000002', 'store_papers') = false);

-- Re-granting at the student's own scope does restore it.
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
        'store_papers', true, 'v1.0', 'in_app_itemised');

select public._t('re-grant after withdrawal restores consent',
  public.consent_is_granted('aaaaaaaa-0000-4000-8000-000000000001',
                            'aaaaaaaa-0000-4000-8000-000000000002', 'store_papers') = true);

do $$ begin
  begin
    insert into public.paper (student_id) values ('aaaaaaaa-0000-4000-8000-000000000002');
    perform public._t('paper write allowed again after re-grant', true, null);
  exception when others then
    perform public._t('paper write allowed again after re-grant', false, 'raised ' || sqlstate);
  end;
end $$;

-- An optional purpose with no row on record is off, not on.
select public._t('optional purposes default to off',
  public.consent_is_granted('aaaaaaaa-0000-4000-8000-000000000001',
                            'aaaaaaaa-0000-4000-8000-000000000002', 'weekly_parent_digest') = false);

-- ── report ─────────────────────────────────────────────────────────────────

select
  count(*)                            as total,
  count(*) filter (where passed)      as passed,
  count(*) filter (where not passed)  as failed
from public._rls_test_results;

select seq, name, passed, detail
from public._rls_test_results
where not passed
order by seq;

rollback;
