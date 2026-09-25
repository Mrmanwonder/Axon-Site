-- ============================================================================
-- Security remediation: Parent Mode must require interactive authentication
-- ============================================================================
--
-- Finding AUTH-002 (2026-09-15): `private.auth_age()` originally used the
-- newest timestamp from *any* JWT `amr` entry. Supabase can emit
-- `method = 'token_refresh'` when it rotates an access token. A refresh proves
-- possession of a refresh token; it does NOT prove that the guardian is present
-- now. Treating it as fresh authentication can therefore reopen the 15-minute
-- Parent Mode window on a shared student device without the parent entering a
-- code.
--
-- The product currently opens Parent Mode explicitly with an OTP. Initial
-- interactive sign-ins may also use password/OAuth/SSO/TOTP/magic-link. Those
-- all require a person to perform an authentication ceremony, so they may start
-- the freshness window. Background/session-maintenance methods must not.
--
-- Keep this as an allow-list. New Supabase AMR methods fail closed until they
-- are deliberately classified rather than silently acquiring guardian power.
-- ============================================================================

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
       and (e->>'method') in (
         'otp',
         'totp',
         'password',
         'oauth',
         'sso/saml',
         'magiclink'
       )
  ) v;
$$;

revoke all on function private.auth_age() from public, anon;
grant execute on function private.auth_age() to authenticated;

comment on function private.auth_age is
  'Time since the session last performed an interactive authentication ceremony, from the signed JWT amr claim. Background token_refresh and other non-interactive AMR methods are deliberately ignored. Null means no qualifying proof and must fail closed.';
