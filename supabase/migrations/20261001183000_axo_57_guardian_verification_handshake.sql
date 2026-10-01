-- ============================================================================
-- AXO-57 · provider-agnostic verification handshake: bound state, atomic
-- callback, replay and freshness defence
-- ============================================================================
-- 20260909111419 made the assertion something only the service role can
-- write, single-use and expiring. What it left to "a server-side provider
-- callback" was the binding: nothing tied a provider's result to the guardian
-- who started the check, so a callback carrying B's completed check could be
-- written against A.
--
-- begin_guardian_verification()  authenticated, fresh Parent Mode only. Mints
--   one opaque state bound to this auth user AND this auth session, stores only
--   its SHA-256, and returns it once for the provider redirect.
--
-- record_guardian_verification_callback(...)  service role only — the backend
--   calls it after checking the provider's signature. It consumes the state
--   atomically (row lock), requires the same provider, an unexpired state and
--   a fresh provider timestamp, and writes the assertion for the auth user the
--   state was minted for — never one named by the callback.
--
-- No provider is wired here (AXO-56 is undecided). Claim flags pass through
-- unchanged; claim_guardian_verification still decides what is sufficient.
-- ============================================================================

create table if not exists private.guardian_verification_session (
  id              uuid primary key default gen_random_uuid(),
  state_hash      text not null unique,
  auth_user_id    uuid not null references auth.users (id) on delete cascade,
  auth_session_id text not null,
  provider        text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  consumed_at     timestamptz
);
alter table private.guardian_verification_session enable row level security;
revoke all on private.guardian_verification_session from public, anon, authenticated;

comment on table private.guardian_verification_session is
  'AXO-57. One started verification: binds a provider round-trip to the guardian and auth session that began it. Only the SHA-256 of the state is stored. No policy: never readable by a client.';

create index if not exists guardian_verification_session_user_idx
  on private.guardian_verification_session (auth_user_id) where consumed_at is null;

create or replace function public.begin_guardian_verification(p_provider text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_auth    uuid := (select auth.uid());
  v_session text := private.current_auth_session_id();
  v_state   text;
  v_expires timestamptz := now() + interval '15 minutes';
begin
  if v_auth is null or v_session is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.guardian g where g.auth_user_id = v_auth and g.deleted_at is null) then
    raise exception 'no account for this session' using errcode = '42501';
  end if;
  if not private.has_fresh_auth() then
    raise exception 'verification needs a parent to confirm it is them'
      using errcode = '42501', hint = 'parent_mode_required';
  end if;
  -- Only a real provider in public.verify_method, never the development stub:
  -- claim_guardian_verification records the provider as that enum.
  if p_provider is null or p_provider = 'stub'
     or not exists (select 1 from pg_catalog.pg_enum e
                     where e.enumtypid = 'public.verify_method'::pg_catalog.regtype and e.enumlabel = p_provider) then
    raise exception 'unknown verification provider' using errcode = '22023';
  end if;
  -- At most a handful of open checks per account; older ones lapse.
  if (select count(*) from private.guardian_verification_session s
       where s.auth_user_id = v_auth and s.consumed_at is null and s.expires_at > now()) >= 5 then
    raise exception 'too many verification attempts in progress' using errcode = '54000';
  end if;

  v_state := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.guardian_verification_session (state_hash, auth_user_id, auth_session_id, provider, expires_at)
  values (encode(extensions.digest(v_state, 'sha256'), 'hex'), v_auth, v_session, p_provider, v_expires);

  return jsonb_build_object('state', v_state, 'provider', p_provider, 'expires_at', v_expires);
end; $$;

revoke all on function public.begin_guardian_verification(text) from public, anon;
grant execute on function public.begin_guardian_verification(text) to authenticated;

comment on function public.begin_guardian_verification is
  'AXO-57. Starts a provider check for the calling guardian (fresh Parent Mode). Returns a one-time state for the provider round-trip; creates no verification.';

create or replace function public.record_guardian_verification_callback(
  p_state        text,
  p_provider     text,
  p_reference    text,
  p_identity     boolean,
  p_adulthood    boolean,
  p_relationship boolean,
  p_issued_at    timestamptz
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_session   private.guardian_verification_session;
  v_assertion uuid;
begin
  if p_state is null or p_reference is null or length(p_reference) not between 1 and 200 then
    raise exception 'malformed verification callback' using errcode = '22023';
  end if;

  select * into v_session
    from private.guardian_verification_session s
   where s.state_hash = encode(extensions.digest(p_state, 'sha256'), 'hex')
     for update;

  if v_session.id is null then
    raise exception 'unknown verification state' using errcode = '42501', hint = 'unknown_state';
  end if;
  if v_session.consumed_at is not null then
    raise exception 'verification state already used' using errcode = '42501', hint = 'replayed_state';
  end if;
  if v_session.expires_at <= now() then
    raise exception 'verification state expired' using errcode = '42501', hint = 'expired_state';
  end if;
  if v_session.provider <> p_provider then
    raise exception 'verification provider mismatch' using errcode = '42501', hint = 'wrong_provider';
  end if;
  if p_issued_at is null or p_issued_at < now() - interval '10 minutes' or p_issued_at > now() + interval '1 minute' then
    raise exception 'verification result is not fresh' using errcode = '42501', hint = 'stale_result';
  end if;

  update private.guardian_verification_session set consumed_at = now() where id = v_session.id;

  -- unique (provider, provider_reference) rejects a provider result replayed
  -- through a second, legitimately started state.
  insert into private.guardian_verification_assertion
    (auth_user_id, provider, provider_reference, identity_verified, adulthood_verified, relationship_verified, expires_at)
  values (v_session.auth_user_id, p_provider, p_reference,
          coalesce(p_identity, false), coalesce(p_adulthood, false), coalesce(p_relationship, false),
          now() + interval '15 minutes')
  returning id into v_assertion;

  return v_assertion;
end; $$;

revoke all on function public.record_guardian_verification_callback(text, text, text, boolean, boolean, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.record_guardian_verification_callback(text, text, text, boolean, boolean, boolean, timestamptz) to service_role;

comment on function public.record_guardian_verification_callback is
  'AXO-57. Service role only, after the backend has verified the provider signature. Consumes a begin_guardian_verification state once and writes an assertion for the guardian who started it.';
