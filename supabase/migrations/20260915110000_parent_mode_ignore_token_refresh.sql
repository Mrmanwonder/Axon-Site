-- ============================================================================
-- Parent Mode freshness must mean a person authenticated, not a token rotated
-- ============================================================================
--
-- Supabase records token rotation in the JWT's `amr` array as `token_refresh`.
-- A refresh obtains a new access token from the long-lived refresh token; it is
-- not a fresh proof that the guardian is physically present. The previous
-- private.auth_age() used the newest timestamp from *every* AMR entry, so a
-- routine automatic refresh could make a hours-old guardian authentication look
-- seconds old and reopen Parent Mode.
--
-- Keep every authentication method Supabase may legitimately issue, but ignore
-- the one method we know is explicitly non-interactive. This is intentionally
-- narrower than an allow-list: new interactive methods should not break Parent
-- Mode simply because Axon has not yet learned their names. If Supabase adds
-- another non-interactive AMR method, add it here with a regression test before
-- relying on it in production.

create or replace function private.auth_age()
returns interval
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when v.latest is null then null
    else now() - to_timestamp(v.latest)
  end
  from (
    select max((e->>'timestamp')::bigint) as latest
      from jsonb_array_elements(
             coalesce(nullif((select auth.jwt() -> 'amr'), 'null'::jsonb), '[]'::jsonb)
           ) e
     where (e ? 'timestamp')
       and coalesce(e->>'method', '') <> 'token_refresh'
  ) v;
$$;

revoke all on function private.auth_age() from public, anon;
grant execute on function private.auth_age() to authenticated;

comment on function private.auth_age is
  'Time since this session last performed a real authentication, from JWT amr. token_refresh is ignored because rotating an access token is not proof that a guardian is present. Null means no usable authentication method and must fail closed.';
