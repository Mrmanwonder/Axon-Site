-- ============================================================================
-- Test suite: AXO-57 guardian verification handshake
-- ============================================================================
-- The provider callback path cannot be forged, replayed, cross-applied or
-- stretched past its freshness window. Synthetic accounts; rolls back.
--   psql "$DATABASE_URL" -f supabase/tests/axo_57_verification_handshake.sql
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

create or replace function public._claims(p_sub text, p_session text, p_amr_age interval)
returns text language sql as $$
  select jsonb_build_object('sub', p_sub, 'role', 'authenticated', 'session_id', p_session,
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from (now() - p_amr_age)))::bigint)))::text;
$$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','a5700000-1111-4111-8111-111111111111','authenticated','authenticated','a57@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','b5700000-2222-4222-8222-222222222222','authenticated','authenticated','b57@test.invalid','x',now(),now(),now());
insert into public.guardian (id, auth_user_id, name, contact) values
 ('a5700000-0000-4000-8000-000000000001','a5700000-1111-4111-8111-111111111111','A','a57@test.invalid'),
 ('b5700000-0000-4000-8000-000000000001','b5700000-2222-4222-8222-222222222222','B','b57@test.invalid');

create temp table _s (who text primary key, state text);
grant all on _s to authenticated;

-- A starts a check in fresh Parent Mode; B starts one too.
set local role authenticated;
select set_config('request.jwt.claims', public._claims('a5700000-1111-4111-8111-111111111111', 'sess-a', interval '10 seconds'), true);
insert into _s select 'a', public.begin_guardian_verification('digilocker') ->> 'state';
insert into _s select 'a2', public.begin_guardian_verification('digilocker') ->> 'state';
select set_config('request.jwt.claims', public._claims('b5700000-2222-4222-8222-222222222222', 'sess-b', interval '10 seconds'), true);
insert into _s select 'b', public.begin_guardian_verification('digilocker') ->> 'state';

do $$ begin
  perform public.begin_guardian_verification('stub');
  perform public._t('the development stub cannot start a check', false, 'started');
exception when invalid_parameter_value then perform public._t('the development stub cannot start a check', true, sqlstate); end $$;

-- Stale Parent Mode cannot start a check.
select set_config('request.jwt.claims', public._claims('b5700000-2222-4222-8222-222222222222', 'sess-b', interval '2 hours'), true);
do $$ begin
  perform public.begin_guardian_verification('digilocker');
  perform public._t('starting a check needs fresh Parent Mode', false, 'started');
exception when insufficient_privilege then perform public._t('starting a check needs fresh Parent Mode', true, sqlstate); end $$;

-- The browser cannot record a callback, cannot read sessions, cannot claim without an assertion.
do $$ begin
  perform public.record_guardian_verification_callback((select state from _s where who = 'b'), 'digilocker', 'forged', true, true, true, now());
  perform public._t('a browser cannot record a provider callback', false, 'recorded');
exception when insufficient_privilege then perform public._t('a browser cannot record a provider callback', true, sqlstate); end $$;
do $$ begin
  perform 1 from private.guardian_verification_session;
  perform public._t('a browser cannot read verification sessions', false, 'read');
exception when insufficient_privilege then perform public._t('a browser cannot read verification sessions', true, sqlstate); end $$;
select set_config('request.jwt.claims', public._claims('b5700000-2222-4222-8222-222222222222', 'sess-b', interval '10 seconds'), true);
do $$ begin
  perform public.claim_guardian_verification();
  perform public._t('claiming before any provider result verifies nobody', false, 'claimed');
exception when insufficient_privilege then perform public._t('claiming before any provider result verifies nobody', true, sqlstate); end $$;
reset role;

-- Server side (service role equivalent): the callbacks.
do $$
declare v uuid;
begin
  -- B's provider result arrives carrying B's state: it binds to B, whatever the payload claims.
  v := public.record_guardian_verification_callback((select state from _s where who = 'b'), 'digilocker', 'txn-b', true, true, true, now());
  perform public._t('a callback binds to the guardian who started the check',
    (select auth_user_id from private.guardian_verification_assertion where id = v) = 'b5700000-2222-4222-8222-222222222222');

  begin
    perform public.record_guardian_verification_callback((select state from _s where who = 'b'), 'digilocker', 'txn-b-2', true, true, true, now());
    perform public._t('a used state cannot be replayed', false, 'accepted');
  exception when insufficient_privilege then perform public._t('a used state cannot be replayed', sqlerrm like '%already used%', sqlerrm); end;

  begin
    perform public.record_guardian_verification_callback((select state from _s where who = 'a'), 'digilocker', 'txn-b', true, true, true, now());
    perform public._t('one provider result cannot be replayed into another check', false, 'accepted');
  exception when unique_violation then perform public._t('one provider result cannot be replayed into another check', true, sqlstate); end;

  begin
    perform public.record_guardian_verification_callback('not-a-state', 'digilocker', 'txn-x', true, true, true, now());
    perform public._t('an unknown state is refused', false, 'accepted');
  exception when insufficient_privilege then perform public._t('an unknown state is refused', true, sqlstate); end;

  begin
    perform public.record_guardian_verification_callback((select state from _s where who = 'a'), 'other-provider', 'txn-a', true, true, true, now());
    perform public._t('a result from a different provider is refused', false, 'accepted');
  exception when insufficient_privilege then perform public._t('a result from a different provider is refused', sqlerrm like '%mismatch%', sqlerrm); end;

  begin
    perform public.record_guardian_verification_callback((select state from _s where who = 'a'), 'digilocker', 'txn-a', true, true, true, now() - interval '1 hour');
    perform public._t('a stale provider result is refused', false, 'accepted');
  exception when insufficient_privilege then perform public._t('a stale provider result is refused', sqlerrm like '%not fresh%', sqlerrm); end;

  update private.guardian_verification_session set expires_at = now() - interval '1 second'
   where state_hash = encode(extensions.digest((select state from _s where who = 'a2'), 'sha256'), 'hex');
  begin
    perform public.record_guardian_verification_callback((select state from _s where who = 'a2'), 'digilocker', 'txn-a2', true, true, true, now());
    perform public._t('an expired state is refused', false, 'accepted');
  exception when insufficient_privilege then perform public._t('an expired state is refused', sqlerrm like '%expired%', sqlerrm); end;

  -- A's genuine result, but the provider could not prove adulthood.
  perform public.record_guardian_verification_callback((select state from _s where who = 'a'), 'digilocker', 'txn-a', true, false, true, now());
end $$;

-- Claims.
set local role authenticated;
select set_config('request.jwt.claims', public._claims('a5700000-1111-4111-8111-111111111111', 'sess-a', interval '10 seconds'), true);
do $$ begin
  perform public.claim_guardian_verification();
  perform public._t('an assertion that did not prove adulthood cannot verify', false, 'claimed');
exception when insufficient_privilege then perform public._t('an assertion that did not prove adulthood cannot verify', true, sqlstate); end $$;
select public._t('A did not inherit B''s verification',
  (select verified_at is null from public.guardian where id = 'a5700000-0000-4000-8000-000000000001'));

select set_config('request.jwt.claims', public._claims('b5700000-2222-4222-8222-222222222222', 'sess-b', interval '10 seconds'), true);
select public._t('B claims its own completed check',
  (select (public.claim_guardian_verification()).verified_at is not null));
do $$ begin
  perform public.claim_guardian_verification();
  perform public._t('an assertion is single-use', false, 'claimed twice');
exception when insufficient_privilege then perform public._t('an assertion is single-use', true, sqlstate); end $$;
reset role;

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
