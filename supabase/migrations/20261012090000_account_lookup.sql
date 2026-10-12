-- Account lookup for the email-first sign-in step (12 Oct 2026, owner request).
--
-- The account step recognises, while the guardian types their email, whether
-- they already have a password account, an account that signs in with a code
-- (Google or email code, no password), or no account at all. That is account
-- enumeration by design, so it is bounded:
--
--   * Only the Edge Function `account-lookup` can call it (service_role). The
--     browser never reaches this function or auth.users directly.
--   * It answers with three words and nothing else: no id, no name, no
--     provider, no profile or student data.
--   * Each caller (an HMAC of its address, never the address) is allowed
--     30 lookups in any 10 minutes. Past that it answers 'throttled' and the
--     screen falls back to the neutral sign-in form.
--
-- The throttle rows hold only a hash and a time, and are deleted after an hour.

create table if not exists private.account_lookup_hit (
  client_hash text        not null,
  hit_at      timestamptz not null default now()
);
create index if not exists account_lookup_hit_client_idx
  on private.account_lookup_hit (client_hash, hit_at);
create index if not exists account_lookup_hit_age_idx
  on private.account_lookup_hit (hit_at);
alter table private.account_lookup_hit enable row level security;
revoke all on private.account_lookup_hit from public, anon, authenticated;

create or replace function public.account_lookup(p_email text, p_client text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_client   text := coalesce(nullif(btrim(p_client), ''), 'unknown');
  v_recent   integer;
  v_password boolean;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' or length(v_email) > 254 then
    return 'invalid';
  end if;

  delete from private.account_lookup_hit where hit_at < now() - interval '1 hour';

  select count(*) into v_recent from private.account_lookup_hit
   where client_hash = v_client and hit_at > now() - interval '10 minutes';
  if v_recent >= 30 then
    return 'throttled';
  end if;
  insert into private.account_lookup_hit (client_hash) values (v_client);

  select coalesce(u.encrypted_password, '') <> '' into v_password
    from auth.users u
   where u.email = v_email and u.deleted_at is null
   limit 1;

  if v_password is null then return 'new'; end if;
  return case when v_password then 'password' else 'code' end;
end;
$$;

revoke all on function public.account_lookup(text, text) from public, anon, authenticated;
grant execute on function public.account_lookup(text, text) to service_role;
