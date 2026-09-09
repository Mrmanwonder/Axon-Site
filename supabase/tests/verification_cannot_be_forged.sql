-- ============================================================================
-- Test suite: a signed-in browser cannot verify itself
-- ============================================================================
-- Re-audit P0-A. The first fix stopped the browser writing verification columns
-- directly and routed them through a SECURITY DEFINER RPC — then granted that
-- RPC to `authenticated` and validated its method argument as "not the stub".
-- The enum holds two values, so `digilocker` passed by construction and the
-- forge moved rather than closed:
--
--     select public.record_guardian_verification('digilocker', 'anything');
--
-- The first assertion below is that exact call, as `authenticated`, with a
-- valid session. It must fail. Everything else in this file exists so the fix
-- cannot be satisfied by breaking verification altogether.
--
-- The general shape of this bug is worth naming, because it is the one the
-- re-audit found repeatedly: a SECURITY DEFINER function creates no trust when
-- the fact it attests arrives as an argument from the caller. Server-authored
-- is not server-validated.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/verification_cannot_be_forged.sql
--   Pass: final SELECT reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

create or replace function public._claims(p_sub text, p_amr_age interval)
returns text language sql as $$
  select jsonb_build_object(
    'sub', p_sub, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'otp',
      'timestamp', floor(extract(epoch from (now() - p_amr_age)))::bigint))
  )::text;
$$;

-- ── fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','a7777777-7777-4777-8777-777777777777','authenticated','authenticated','forge@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','b8888888-8888-4888-8888-888888888888','authenticated','authenticated','other@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact) values
 ('a7000000-0000-4000-8000-000000000001','a7777777-7777-4777-8777-777777777777','Guardian G','g@test.invalid'),
 ('b8000000-0000-4000-8000-000000000001','b8888888-8888-4888-8888-888888888888','Guardian H','h@test.invalid');

-- ══════════════════════════════════════════════════════════════════════════
-- The exploit, exactly as reported
-- ══════════════════════════════════════════════════════════════════════════

set local role authenticated;
select set_config('request.jwt.claims', public._claims('a7777777-7777-4777-8777-777777777777', interval '10 seconds'), true);

select public._t('the guardian starts unverified',
  (select verified_at is null from public.guardian where id='a7000000-0000-4000-8000-000000000001'));

do $$ begin
  perform public.record_guardian_verification('digilocker', 'made-up-reference');
  perform public._t('an authenticated caller cannot forge a digilocker verification', false,
    'THE EXPLOIT WORKS — the call succeeded');
exception when insufficient_privilege then
  perform public._t('an authenticated caller cannot forge a digilocker verification', true);
when others then
  perform public._t('an authenticated caller cannot forge a digilocker verification', true, sqlerrm);
end $$;

select public._t('and is still unverified afterwards',
  (select verified_at is null from public.guardian where id='a7000000-0000-4000-8000-000000000001'));

-- Fresh Parent Mode must not help. Freshness proves a parent is present; it
-- proves nothing about a provider having checked anyone.
do $$ begin
  perform public.record_guardian_verification('stub', 'stub:anything');
  perform public._t('nor with the stub method', false, 'the call succeeded');
exception when others then
  perform public._t('nor with the stub method', true);
end $$;

-- The redeem path exists and is callable, but redeems nothing that was never
-- asserted. This is the assertion that stops the fix from being "delete the
-- feature and call it secure".
do $$ begin
  perform public.claim_guardian_verification();
  perform public._t('claiming with no assertion fails', false, 'the call succeeded');
exception when insufficient_privilege then
  perform public._t('claiming with no assertion fails', true);
when others then
  perform public._t('claiming with no assertion fails', false, sqlerrm);
end $$;

select public._t('authenticated cannot reach the two-argument writer',
  not has_function_privilege('authenticated','public.record_guardian_verification(text,text)','execute'));
select public._t('anon cannot either',
  not has_function_privilege('anon','public.record_guardian_verification(text,text)','execute'));
select public._t('but the service role can, for a provider callback',
  has_function_privilege('service_role','public.record_guardian_verification(text,text)','execute'));

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- With an assertion the service role wrote
-- ══════════════════════════════════════════════════════════════════════════

insert into private.guardian_verification_assertion
  (auth_user_id, provider, provider_reference, identity_verified, adulthood_verified, relationship_verified, expires_at)
values
  ('a7777777-7777-4777-8777-777777777777','digilocker','dl:real-1', true, true, true, now() + interval '10 minutes');

set local role authenticated;
select set_config('request.jwt.claims', public._claims('a7777777-7777-4777-8777-777777777777', interval '10 seconds'), true);

-- Refused outright rather than returning zero rows, which is the stronger of
-- the two: an empty result would still mean the table was reachable.
do $$ begin
  perform 1 from private.guardian_verification_assertion limit 1;
  perform public._t('an authenticated session cannot read the assertion table', false,
    'the select succeeded');
exception when insufficient_privilege then
  perform public._t('an authenticated session cannot read the assertion table', true);
when others then
  perform public._t('an authenticated session cannot read the assertion table', true, sqlerrm);
end $$;

do $$ begin
  perform public.claim_guardian_verification();
  perform public._t('a real assertion verifies the guardian',
    (select verification_method::text = 'digilocker' and verification_ref = 'dl:real-1'
       from public.guardian where id='a7000000-0000-4000-8000-000000000001'));
exception when others then
  perform public._t('a real assertion verifies the guardian', false, sqlerrm);
end $$;

-- Single use: a replayed redeem must not re-verify.
do $$ begin
  perform public.claim_guardian_verification();
  perform public._t('an assertion is single-use', false, 'the second claim succeeded');
exception when insufficient_privilege then
  perform public._t('an assertion is single-use', true);
when others then
  perform public._t('an assertion is single-use', false, sqlerrm);
end $$;

reset role;

-- ── someone else's assertion, and an expired one ──────────────────────────

insert into private.guardian_verification_assertion
  (auth_user_id, provider, provider_reference, identity_verified, adulthood_verified, relationship_verified, expires_at)
values
  ('a7777777-7777-4777-8777-777777777777','digilocker','dl:expired', true, true, true, now() - interval '1 minute'),
  ('a7777777-7777-4777-8777-777777777777','digilocker','dl:partial', true, false, true, now() + interval '10 minutes');

set local role authenticated;
select set_config('request.jwt.claims', public._claims('b8888888-8888-4888-8888-888888888888', interval '10 seconds'), true);

-- Guardian H has no assertion of their own. G's assertions must be invisible.
do $$ begin
  perform public.claim_guardian_verification();
  perform public._t('one guardian cannot consume another''s assertion', false, 'the call succeeded');
exception when insufficient_privilege then
  perform public._t('one guardian cannot consume another''s assertion', true);
when others then
  perform public._t('one guardian cannot consume another''s assertion', false, sqlerrm);
end $$;

select public._t('and guardian H is still unverified',
  (select verified_at is null from public.guardian where id='b8000000-0000-4000-8000-000000000001'));

reset role;

-- G now has only an expired assertion and a partial one (adulthood not
-- established). Neither may verify. Clear the consumed/verified state first so
-- the claim path is reached rather than short-circuited.
update public.guardian
   set verified_at = null, verification_method = null, verification_ref = null
 where id = 'a7000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', public._claims('a7777777-7777-4777-8777-777777777777', interval '10 seconds'), true);

do $$ begin
  perform public.claim_guardian_verification();
  perform public._t('an expired or partial assertion verifies nobody', false, 'the call succeeded');
exception when insufficient_privilege then
  perform public._t('an expired or partial assertion verifies nobody', true);
when others then
  perform public._t('an expired or partial assertion verifies nobody', false, sqlerrm);
end $$;

reset role;

-- A replayed provider callback conflicts rather than minting a second chance.
do $$ begin
  insert into private.guardian_verification_assertion
    (auth_user_id, provider, provider_reference, identity_verified, adulthood_verified, relationship_verified, expires_at)
  values ('a7777777-7777-4777-8777-777777777777','digilocker','dl:real-1', true, true, true, now() + interval '10 minutes');
  perform public._t('a replayed provider reference is rejected', false, 'the insert succeeded');
exception when unique_violation then
  perform public._t('a replayed provider reference is rejected', true);
when others then
  perform public._t('a replayed provider reference is rejected', false, sqlerrm);
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Consent: every decision needs a parent, including the first
-- ══════════════════════════════════════════════════════════════════════════
-- Re-audit P0-C. "No prior row" was treated as proof of onboarding. A purpose
-- introduced later manufactures a new first decision for an existing account.

set local role authenticated;
select set_config('request.jwt.claims', public._claims('a7777777-7777-4777-8777-777777777777', interval '4 hours'), true);

do $$ begin
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('a7000000-0000-4000-8000-000000000001', null, 'store_papers', true, 'v1.0', 'in_app_itemised');
  perform public._t('a stale session cannot make a first consent decision', false,
    'the insert succeeded — the first-consent exemption is still open');
exception when insufficient_privilege then
  perform public._t('a stale session cannot make a first consent decision', true);
when others then
  perform public._t('a stale session cannot make a first consent decision', false, sqlerrm);
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._claims('a7777777-7777-4777-8777-777777777777', interval '10 seconds'), true);

do $$ begin
  insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
  values ('a7000000-0000-4000-8000-000000000001', null, 'store_papers', true, 'v1.0', 'in_app_itemised');
  perform public._t('onboarding still works, because sign-in is seconds old', true);
exception when others then
  perform public._t('onboarding still works, because sign-in is seconds old', false, sqlerrm);
end $$;

reset role;

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
