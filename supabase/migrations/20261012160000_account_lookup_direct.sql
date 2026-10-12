-- Account lookup, one hop (12 Oct 2026, owner: "instantaneous, no delay").
--
-- Measured: the lookup itself runs in about 23 ms. The 1 to 2 s the screen
-- waited (8 s on a cold start) was the Edge Function in front of it: boot, a
-- supabase-js client, and two network hops. The browser now calls this function
-- through the REST API directly, and the Edge Function remains only as the
-- fallback.
--
-- This changes one boundary written in 20261012090000_account_lookup.sql: the
-- browser can now reach a lookup without the Edge Function. The exposure is the
-- same as before (the Edge Function was already callable by a signed-out
-- browser) and the same bounds hold:
--
--   * It answers one word ('new', 'password', 'code') or 'throttled' / 'invalid'.
--     No id, name, provider or profile data.
--   * The caller is identified by its network address as the API gateway saw it
--     (Cloudflare's cf-connecting-ip, which a browser cannot set), hashed with a
--     random salt held in a private table, so no raw address is stored and the
--     hash cannot be reversed by trying every address.
--   * 120 lookups per caller in any 10 minutes (the screen asks as the address
--     is typed), then 'throttled'; the screen falls back to the neutral form.
--   * Throttle rows hold a hash and a time and are deleted after an hour.

create table if not exists private.account_lookup_salt (
  only_row boolean primary key default true check (only_row),
  salt     text not null default gen_random_uuid()::text
);
insert into private.account_lookup_salt default values on conflict do nothing;
alter table private.account_lookup_salt enable row level security;
revoke all on private.account_lookup_salt from public, anon, authenticated;

create or replace function public.account_lookup_public(p_email text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_headers  json;
  v_ip       text;
  v_client   text;
  v_recent   integer;
  v_password boolean;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' or length(v_email) > 254 then
    return 'invalid';
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := coalesce(
    nullif(btrim(v_headers->>'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown');
  v_client := 'ip:' || encode(
    sha256(convert_to(v_ip || (select salt from private.account_lookup_salt), 'UTF8')), 'hex');

  delete from private.account_lookup_hit where hit_at < now() - interval '1 hour';

  select count(*) into v_recent from private.account_lookup_hit
   where client_hash = v_client and hit_at > now() - interval '10 minutes';
  if v_recent >= 120 then
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

revoke all on function public.account_lookup_public(text) from public;
grant execute on function public.account_lookup_public(text) to anon, authenticated;
