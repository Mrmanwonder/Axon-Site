-- ============================================================================
-- Test suite: Parent Mode — the guardian's authority is not the student's
-- ============================================================================
-- Remediation P0-002 / INV-02. The acceptance criterion the spec is most
-- insistent about is that "direct API/RPC calls from Student Mode are rejected
-- server-side, not merely hidden in UI" — so every assertion below is a raw
-- statement issued as `authenticated` with a real, valid, correctly-owned
-- session. Exactly what a student gets by opening the console on the family
-- phone. No screen is involved anywhere in this file.
--
-- Two sessions, distinguished only by their `amr` claim:
--
--   STUDENT MODE  a valid session that authenticated hours ago. This is not a
--                 lesser session: it is the same guardian, same token, same
--                 ownership. Only the freshness differs.
--   PARENT MODE   the same guardian, having just re-authenticated.
--
-- If a test here passes with the student claim, the boundary does not exist.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/parent_mode.sql
--   Pass: final SELECT reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- Claim builders, so every `set local` below reads as what it means rather
-- than as a wall of epoch arithmetic.
create or replace function public._claims(p_sub text, p_amr_age interval)
returns text language sql as $$
  select jsonb_build_object(
    'sub', p_sub,
    'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'otp',
      'timestamp', floor(extract(epoch from (now() - p_amr_age)))::bigint))
  )::text;
$$;

-- ── fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','e5555555-5555-4555-8555-555555555555','authenticated','authenticated','pm@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('eeeeeeee-0000-4000-8000-000000000001','e5555555-5555-4555-8555-555555555555','Guardian E','e@test.invalid',now(),'digilocker','ref-e');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select 'eeeeeeee-0000-4000-8000-000000000001', null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('eeeeeeee-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000001','Ishaan',11,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('eeeeeeee-0000-4000-8000-000000000010','eeeeeeee-0000-4000-8000-000000000002','unit_test','tier_1',current_date - 3,'Physics'),
 ('eeeeeeee-0000-4000-8000-000000000011','eeeeeeee-0000-4000-8000-000000000002','unit_test','tier_1',current_date - 9,'Physics');

-- ══════════════════════════════════════════════════════════════════════════
-- The freshness primitive
-- ══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated"}';

-- A token with no amr at all. This is the case that decides whether the gate
-- fails open or closed, and it is the single most important assertion here:
-- read as "unknown, allow", every other test in this file passes while the
-- boundary does nothing.
select public._t('a token with no amr is not fresh', private.has_fresh_auth() = false);
select public._t('and reports no age rather than zero', private.auth_age() is null);
select public._t('parent_mode_state says so distinguishably',
  (public.parent_mode_state() ->> 'amr_present')::boolean = false
  and (public.parent_mode_state() ->> 'fresh')::boolean = false);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._claims('e5555555-5555-4555-8555-555555555555', interval '4 hours'), true);

select public._t('a session that authenticated hours ago is not fresh',
  private.has_fresh_auth() = false);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._claims('e5555555-5555-4555-8555-555555555555', interval '30 seconds'), true);

select public._t('a session that just re-authenticated is fresh',
  private.has_fresh_auth() = true);
select public._t('and reports time remaining',
  (public.parent_mode_state() ->> 'remaining_seconds')::int between 800 and 900);

-- The boundary of the window, from both sides.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._claims('e5555555-5555-4555-8555-555555555555', interval '14 minutes'), true);
select public._t('fresh just inside the window', private.has_fresh_auth() = true);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._claims('e5555555-5555-4555-8555-555555555555', interval '16 minutes'), true);
select public._t('stale just outside it', private.has_fresh_auth() = false);
select public._t('and Parent Mode has expired, not merely wound down',
  (public.parent_mode_state() ->> 'remaining_seconds')::int = 0);

-- ══════════════════════════════════════════════════════════════════════════
-- STUDENT MODE — a valid session, four hours old
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._claims('e5555555-5555-4555-8555-555555555555', interval '4 hours'), true);

-- Everything the app is for still works. A boundary that stops a student
-- studying has failed differently, not succeeded.
select public._t('student mode reads the library',
  (select count(*) = 2 from public.paper));
select public._t('student mode reads the student profile',
  (select count(*) = 1 from public.student));

do $$ begin
  insert into public.paper (student_id, type, tier, date_taken, subject)
  values ('eeeeeeee-0000-4000-8000-000000000002','unit_test','tier_1',current_date,'Chemistry');
  perform public._t('student mode can add a paper', true);
exception when others then
  perform public._t('student mode can add a paper', false, sqlerrm);
end $$;

do $$ begin
  update public.student set avatar_seed = 'halo' where id='eeeeeeee-0000-4000-8000-000000000002';
  perform public._t('student mode can change their own picture', true);
exception when others then
  perform public._t('student mode can change their own picture', false, sqlerrm);
end $$;

-- Now the control plane. Each of these is the raw statement the corresponding
-- Settings row issues.

do $$ declare n int; begin
  delete from public.paper where student_id = 'eeeeeeee-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform public._t('student mode cannot delete the papers', n = 0,
    format('%s rows deleted', n));
exception when others then
  perform public._t('student mode cannot delete the papers', true);
end $$;

do $$ declare n int; begin
  delete from public.student where id = 'eeeeeeee-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform public._t('student mode cannot delete the student profile', n = 0,
    format('%s rows deleted', n));
exception when others then
  perform public._t('student mode cannot delete the student profile', true);
end $$;

-- Withdrawing a required consent stops all processing and destroys a legal
-- basis. It is the single most consequential switch on the Settings screen.
do $$ begin
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('eeeeeeee-0000-4000-8000-000000000001', null, 'store_papers', false, 'v1.0', 'in_app_itemised');
  perform public._t('student mode cannot withdraw consent', false, 'the insert succeeded');
exception when insufficient_privilege then
  perform public._t('student mode cannot withdraw consent', true);
when others then
  perform public._t('student mode cannot withdraw consent', false, sqlerrm);
end $$;

do $$ begin
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('eeeeeeee-0000-4000-8000-000000000001', null, 'store_papers', true, 'v1.0', 'in_app_itemised');
  perform public._t('student mode cannot re-grant consent either', false, 'the insert succeeded');
exception when insufficient_privilege then
  perform public._t('student mode cannot re-grant consent either', true);
when others then
  perform public._t('student mode cannot re-grant consent either', false, sqlerrm);
end $$;

-- A FIRST decision is gated too, and this assertion was inverted by re-audit
-- P0-C. The original policy exempted a purpose with no prior row, reasoning
-- that a first decision must be onboarding. It need not be: a purpose
-- introduced next year, a second child, or an account migrated without a row
-- each manufacture a new "first" decision that a student holding the guardian
-- session could make alone. `weekly_parent_digest` has no prior row here, which
-- is exactly the case that used to slip through.
do $$ begin
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('eeeeeeee-0000-4000-8000-000000000001', null, 'weekly_parent_digest', true, 'v1.0', 'in_app_itemised');
  perform public._t('a first decision on a new purpose is gated too', false,
    'the insert succeeded — the first-consent exemption is back');
exception when insufficient_privilege then
  perform public._t('a first decision on a new purpose is gated too', true);
when others then
  perform public._t('a first decision on a new purpose is gated too', false, sqlerrm);
end $$;

do $$ begin
  perform public.delete_my_account();
  perform public._t('student mode cannot delete the account', false, 'the account was deleted');
exception when insufficient_privilege then
  perform public._t('student mode cannot delete the account', true);
when others then
  perform public._t('student mode cannot delete the account', false, sqlerrm);
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARENT MODE — the same guardian, having just re-authenticated
-- ══════════════════════════════════════════════════════════════════════════
-- A gate that never opens is not a gate either.

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._claims('e5555555-5555-4555-8555-555555555555', interval '10 seconds'), true);

do $$ begin
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('eeeeeeee-0000-4000-8000-000000000001', null, 'weekly_parent_digest', false, 'v1.0', 'in_app_itemised');
  perform public._t('parent mode can change consent', true);
exception when others then
  perform public._t('parent mode can change consent', false, sqlerrm);
end $$;

do $$ declare n int; begin
  delete from public.paper where student_id = 'eeeeeeee-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform public._t('parent mode can delete the papers', n = 3, format('%s rows deleted', n));
exception when others then
  perform public._t('parent mode can delete the papers', false, sqlerrm);
end $$;

do $$ declare n int; begin
  delete from public.student where id = 'eeeeeeee-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform public._t('parent mode can delete the student profile', n = 1, format('%s rows deleted', n));
exception when others then
  perform public._t('parent mode can delete the student profile', false, sqlerrm);
end $$;

do $$ declare r jsonb; begin
  r := public.delete_my_account();
  perform public._t('parent mode can delete the account', (r->>'erased')::boolean);
  -- Erasure keeps the guardian and student rows as tombstones so the
  -- append-only consent ledger keeps its referents (20260810190200). Asserted
  -- here because adding the Parent Mode gate meant redefining this function,
  -- and redefining it from an older copy silently reintroduces the erasure bug
  -- that migration exists to fix — which is exactly what happened once.
  perform public._t('and still keeps the consent ledger''s referents',
    r ? 'guardian_retained_as_tombstone', r::text);
exception when others then
  perform public._t('parent mode can delete the account', false, sqlerrm);
end $$;

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- Ownership still comes first
-- ══════════════════════════════════════════════════════════════════════════
-- Fresh auth is an ADDITIONAL requirement, never a substitute for owning the
-- row. A freshly re-authenticated stranger must still reach nothing.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','f6666666-6666-4666-8666-666666666666','authenticated','authenticated','other@test.invalid','x',now(),now(),now());
insert into public.guardian (id, auth_user_id, name, contact) values
 ('ffffffff-0000-4000-8000-000000000001','f6666666-6666-4666-8666-666666666666','Guardian F','f@test.invalid');
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select 'ffffffff-0000-4000-8000-000000000001', null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.consent_purpose cp where cp.is_required;
insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('ffffffff-0000-4000-8000-000000000002','ffffffff-0000-4000-8000-000000000001','Nour',11,'under_18');
insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('ffffffff-0000-4000-8000-000000000010','ffffffff-0000-4000-8000-000000000002','unit_test','tier_1',current_date,'Physics');

set local role authenticated;
select set_config('request.jwt.claims', public._claims('f6666666-6666-4666-8666-666666666666', interval '5 seconds'), true);

select public._t('a fresh session is still fresh', private.has_fresh_auth() = true);

do $$ declare n int; begin
  delete from public.paper where student_id = 'eeeeeeee-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform public._t('parent mode does not reach another family''s papers', n = 0,
    format('%s rows deleted', n));
exception when others then
  perform public._t('parent mode does not reach another family''s papers', true);
end $$;

do $$ begin
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('eeeeeeee-0000-4000-8000-000000000001', null, 'store_papers', false, 'v1.0', 'in_app_itemised');
  perform public._t('parent mode does not reach another family''s consent', false,
    'the insert succeeded');
exception when insufficient_privilege then
  perform public._t('parent mode does not reach another family''s consent', true);
when others then
  perform public._t('parent mode does not reach another family''s consent', false, sqlerrm);
end $$;

reset role;

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
